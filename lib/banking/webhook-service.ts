// ============================================================
// FinRP Banking OS — AA Webhook Processing Service
// Normalizes Setu webhook notifications into canonical events,
// enforces idempotency (BankWebhookEvent.externalId unique) and
// replay protection (timestamp window), then routes each event:
//
//   CONSENT_APPROVED      → refresh consent + enqueue initial sync
//   CONSENT_REJECTED      → mark consent REJECTED
//   CONSENT_REVOKED       → mark REVOKED + stop auto-sync
//   CONSENT_PAUSED        → mark PAUSED
//   CONSENT_EXPIRED       → mark EXPIRED + stop auto-sync
//   DATA_READY            → enqueue sync reusing the completed session
//   DATA_FETCH_COMPLETED  → same as DATA_READY
//   DATA_FETCH_FAILED     → record failure on sync history
//   ACCOUNT_LINKED        → refresh consent (links new accounts)
//   ACCOUNT_UNLINKED      → detach account from AA sync
//
// Every received payload is stored, processed or not — full audit.
// ============================================================

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createBankingLogger } from "./logger";
import { refreshConsentStatus } from "./consent-service";
import { enqueueBankSync } from "./queue";

const log = createBankingLogger("webhook-service");

/** Events older than this are treated as replays and ignored. */
const REPLAY_WINDOW_MS = 10 * 60 * 1000;

export type CanonicalBankEvent =
  | "CONSENT_APPROVED"
  | "CONSENT_REJECTED"
  | "CONSENT_REVOKED"
  | "CONSENT_PAUSED"
  | "CONSENT_EXPIRED"
  | "DATA_READY"
  | "DATA_FETCH_COMPLETED"
  | "DATA_FETCH_FAILED"
  | "ACCOUNT_LINKED"
  | "ACCOUNT_UNLINKED"
  | "UNKNOWN";

interface NormalizedWebhookEvent {
  eventType: CanonicalBankEvent;
  rawType: string;
  externalId: string;
  consentId?: string;
  dataSessionId?: string;
  timestamp?: Date;
  payload: Record<string, unknown>;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

// ---------------------------------------------------------------------------
// Normalization — accepts Setu-native types (CONSENT_STATUS_UPDATE /
// SESSION_STATUS_UPDATE) and the canonical names directly.
// ---------------------------------------------------------------------------
export function normalizeWebhookPayload(payload: JsonRecord, rawBody: string): NormalizedWebhookEvent[] {
  // Setu may batch notifications; support single-object and array forms.
  const items: JsonRecord[] = Array.isArray(payload)
    ? (payload as JsonRecord[])
    : Array.isArray(payload.notifications)
      ? (payload.notifications as JsonRecord[])
      : [payload];

  return items.map((item, index) => {
    const data = asRecord(item.data);
    const rawType = String(item.type ?? item.event ?? item.eventType ?? "").toUpperCase();
    const status = String(data.status ?? item.status ?? "").toUpperCase();

    let eventType: CanonicalBankEvent = "UNKNOWN";
    if (rawType === "CONSENT_STATUS_UPDATE" || rawType === "CONSENT_NOTIFICATION") {
      eventType =
        status === "ACTIVE" ? "CONSENT_APPROVED"
        : status === "REJECTED" ? "CONSENT_REJECTED"
        : status === "REVOKED" ? "CONSENT_REVOKED"
        : status === "PAUSED" ? "CONSENT_PAUSED"
        : status === "EXPIRED" ? "CONSENT_EXPIRED"
        : "UNKNOWN";
    } else if (rawType === "SESSION_STATUS_UPDATE" || rawType === "FI_NOTIFICATION") {
      eventType =
        status === "COMPLETED" || status === "PARTIAL" || status === "READY" ? "DATA_READY"
        : status === "FAILED" || status === "EXPIRED" ? "DATA_FETCH_FAILED"
        : "UNKNOWN";
    } else if (
      [
        "CONSENT_APPROVED", "CONSENT_REJECTED", "CONSENT_REVOKED", "CONSENT_PAUSED",
        "CONSENT_EXPIRED", "DATA_READY", "DATA_FETCH_COMPLETED", "DATA_FETCH_FAILED",
        "ACCOUNT_LINKED", "ACCOUNT_UNLINKED",
      ].includes(rawType)
    ) {
      eventType = rawType as CanonicalBankEvent;
    }

    const consentId =
      firstString(item.consentId, data.consentId, asRecord(item.ConsentHandle).id, asRecord(data.consent).id);
    const dataSessionId = firstString(item.dataSessionId, data.sessionId, data.dataSessionId, item.sessionId);

    const timestampStr = firstString(item.timestamp, item.createdAt, data.timestamp);
    const timestamp = timestampStr ? new Date(timestampStr) : undefined;

    // Provider notification id when present; deterministic body hash otherwise
    // so identical replays always collide on the unique index.
    const externalId =
      firstString(item.notificationId, item.id, item.txnid) ??
      `sha256:${createHash("sha256").update(`${rawBody}:${index}`).digest("hex")}`;

    return {
      eventType,
      rawType: rawType || "(missing)",
      externalId,
      consentId,
      dataSessionId,
      timestamp: timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : undefined,
      payload: item,
    };
  });
}

function firstString(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Entry point called by the webhook route. Never throws — the route
// always returns 2xx after signature checks so the provider doesn't
// hammer us on internal errors; failures are stored for inspection.
// ---------------------------------------------------------------------------
export async function processBankWebhook(opts: {
  rawBody: string;
  payload: JsonRecord;
  signature: string | null;
  signatureValid: boolean;
}): Promise<{ stored: number; processed: number; duplicates: number }> {
  const events = normalizeWebhookPayload(opts.payload, opts.rawBody);
  let stored = 0;
  let processed = 0;
  let duplicates = 0;

  for (const event of events) {
    // Resolve tenant from the consent (may be null for foreign consents).
    const consent = event.consentId
      ? await prisma.bankConsent.findFirst({
          where: { OR: [{ consentId: event.consentId }, { consentHandle: event.consentId }] },
          select: { id: true, organizationId: true, bankAccountId: true, status: true },
        })
      : null;

    // Replay protection: stale timestamps are stored but never processed.
    const isStale =
      event.timestamp !== undefined && Date.now() - event.timestamp.getTime() > REPLAY_WINDOW_MS;

    let record;
    try {
      record = await prisma.bankWebhookEvent.create({
        data: {
          organizationId: consent?.organizationId ?? null,
          provider: "SETU",
          eventType: event.eventType,
          externalId: event.externalId,
          consentId: event.consentId,
          dataSessionId: event.dataSessionId,
          payload: event.payload as Prisma.InputJsonValue,
          rawBody: opts.rawBody.slice(0, 10_000),
          signature: opts.signature,
          signatureValid: opts.signatureValid,
          status: isStale ? "IGNORED" : "PROCESSING",
          error: isStale ? "Stale timestamp — replay window exceeded" : null,
        },
      });
      stored++;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // Duplicate externalId — replayed/redelivered notification.
        duplicates++;
        log.info("webhook duplicate ignored", { externalId: event.externalId, eventType: event.eventType });
        continue;
      }
      log.error("webhook event store failed", { error: String(err), eventType: event.eventType });
      continue;
    }

    if (isStale) {
      log.warn("webhook replay ignored", { externalId: event.externalId, timestamp: event.timestamp });
      continue;
    }

    try {
      await routeEvent(event, consent);
      await prisma.bankWebhookEvent.update({
        where: { id: record.id },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.bankWebhookEvent.update({
        where: { id: record.id },
        data: { status: "FAILED", error: message.slice(0, 1000), retryCount: { increment: 1 } },
      }).catch(() => {});
      log.error("webhook event processing failed", {
        externalId: event.externalId,
        eventType: event.eventType,
        error: message,
      });
    }
  }

  return { stored, processed, duplicates };
}

// ---------------------------------------------------------------------------
// Event routing
// ---------------------------------------------------------------------------
async function routeEvent(
  event: NormalizedWebhookEvent,
  consent: { id: string; organizationId: string; bankAccountId: string | null; status: string } | null
): Promise<void> {
  log.info("webhook event", { eventType: event.eventType, rawType: event.rawType, consentId: event.consentId });

  switch (event.eventType) {
    case "CONSENT_APPROVED": {
      if (!event.consentId) return;
      const updated = await refreshConsentStatus(event.consentId);
      if (updated?.status === "ACTIVE") {
        await enqueueBankSync({
          organizationId: updated.organizationId,
          consentDbId: updated.id,
          bankAccountId: updated.bankAccountId ?? undefined,
          provider: "SETU_AA",
          trigger: "WEBHOOK",
          syncType: "FULL",
        });
      }
      break;
    }

    case "CONSENT_REJECTED":
    case "CONSENT_REVOKED":
    case "CONSENT_PAUSED":
    case "CONSENT_EXPIRED": {
      if (!consent) return;
      const statusMap = {
        CONSENT_REJECTED: "REJECTED",
        CONSENT_REVOKED: "REVOKED",
        CONSENT_PAUSED: "PAUSED",
        CONSENT_EXPIRED: "EXPIRED",
      } as const;
      const status = statusMap[event.eventType];
      await prisma.bankConsent.update({
        where: { id: consent.id },
        data: {
          status,
          ...(status === "REJECTED" ? { rejectedAt: new Date() } : {}),
          ...(status === "REVOKED" ? { revokedAt: new Date() } : {}),
        },
      });
      if (consent.bankAccountId && (status === "REVOKED" || status === "EXPIRED")) {
        await prisma.bankAccount.update({
          where: { id: consent.bankAccountId },
          data: { consentStatus: status, autoSyncEnabled: false },
        }).catch(() => {});
      }
      break;
    }

    case "DATA_READY":
    case "DATA_FETCH_COMPLETED": {
      if (!consent) return;
      await enqueueBankSync(
        {
          organizationId: consent.organizationId,
          consentDbId: consent.id,
          bankAccountId: consent.bankAccountId ?? undefined,
          existingSessionId: event.dataSessionId,
          provider: "SETU_AA",
          trigger: "WEBHOOK",
        },
        // Session-scoped dedup so each completed session syncs exactly once.
        event.dataSessionId ? { dedupeKey: `session:${event.dataSessionId}` } : undefined
      );
      break;
    }

    case "DATA_FETCH_FAILED": {
      if (!event.dataSessionId) return;
      await prisma.bankSyncHistory.updateMany({
        where: { dataSessionId: event.dataSessionId, status: { in: ["QUEUED", "RUNNING"] } },
        data: { status: "FAILED", error: "Provider reported data session failure", errorCode: "SESSION_FAILED" },
      });
      break;
    }

    case "ACCOUNT_LINKED": {
      if (event.consentId) await refreshConsentStatus(event.consentId);
      break;
    }

    case "ACCOUNT_UNLINKED": {
      const data = asRecord(event.payload.data);
      const linkRef = firstString(data.linkRefNumber, event.payload.linkRefNumber);
      if (!linkRef || !consent) return;
      await prisma.bankAccount.updateMany({
        where: { organizationId: consent.organizationId, linkedAccountRef: linkRef },
        data: { consentStatus: "NONE", autoSyncEnabled: false },
      });
      break;
    }

    default:
      log.warn("unhandled webhook event type", { rawType: event.rawType });
  }
}
