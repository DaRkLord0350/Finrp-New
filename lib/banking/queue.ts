// ============================================================
// FinRP Banking OS — Bank sync dispatch (Inngest-backed)
//
// enqueueBankSync now emits a `bank/sync.requested` event instead of
// adding a BullMQ job. The deterministic dedupe key is reused as the
// Inngest event id so double-clicks and duplicate webhooks collapse
// into a single run. The periodic "accounts due for refresh" scan moved
// to the bank-auto-sync cron (inngest/functions/scheduled.ts).
// ============================================================

import { inngest } from "@/inngest/client";
import { EVENTS } from "@/inngest/events";
import { createBankingLogger } from "./logger";
import type { BankImportJobData } from "./types";
import type { SyncTrigger, SyncType } from "@prisma/client";

const log = createBankingLogger("dispatch");

export const BANK_SYNC_QUEUE = "finrp-bank-sync";
export const BANK_IMPORT_QUEUE = "finrp-bank-import";

/** Label for the scheduled scan (kept for the cron + monitoring). */
export const BANK_AUTO_SYNC_JOB = "bank-auto-sync-scan";
export const BANK_AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 min

export interface BankSyncQueueJobData {
  bankSyncJobId: string;
  organizationId: string;
  bankAccountId?: string;
  consentDbId?: string;
  /** BankConnection.id — Plaid/direct-API providers only. */
  connectionId?: string;
  /** Reuse an already-completed Setu data session (webhook path). */
  existingSessionId?: string;
  provider: string;
  trigger: SyncTrigger;
  syncType?: SyncType;
  fromDate?: string;
  toDate?: string;
}

/**
 * Dispatch a bank sync. jobId is deterministic per (org, account, trigger,
 * 5-min bucket) so double-clicks and duplicate webhooks collapse into one run.
 */
export async function enqueueBankSync(
  data: Omit<BankSyncQueueJobData, "bankSyncJobId">,
  opts?: { dedupeKey?: string }
): Promise<string> {
  const bucket = Math.floor(Date.now() / (5 * 60_000));
  const dedupe =
    opts?.dedupeKey ??
    `${data.organizationId}:${data.bankAccountId ?? data.consentDbId ?? "org"}:${data.trigger}:${bucket}`;
  const jobId = `bank-sync:${dedupe}`;

  await inngest.send({
    name: EVENTS.BANK_SYNC_REQUESTED,
    data: { ...data, bankSyncJobId: jobId },
    id: jobId, // event-level idempotency → collapses duplicate dispatches
  });

  log.info("bank sync dispatched", {
    jobId,
    organizationId: data.organizationId,
    bankAccountId: data.bankAccountId,
    trigger: data.trigger,
  });
  return jobId;
}

/**
 * Replaced by the bank-auto-sync cron (inngest/functions/scheduled.ts).
 * Kept as a no-op so legacy callers don't break.
 */
export async function scheduleBankAutoSyncScan(): Promise<void> {
  log.info("scheduleBankAutoSyncScan is a no-op — handled by the bank-auto-sync cron");
}

/**
 * Dispatch a bank statement import (CSV/Excel/PDF). Deterministic event id
 * per importId so a duplicate submit collapses onto one run.
 */
export async function enqueueBankImport(data: BankImportJobData): Promise<string> {
  const jobId = `bank-import-${data.importId}`;
  await inngest.send({ name: EVENTS.BANK_IMPORT_REQUESTED, data, id: jobId });
  log.info("bank import dispatched", { jobId, organizationId: data.organizationId });
  return jobId;
}
