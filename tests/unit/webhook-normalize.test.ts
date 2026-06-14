// ============================================================
// Unit tests — lib/banking/webhook-service.ts (normalization)
// Setu-native → canonical event mapping, batching, replay ids.
// Heavy deps (prisma / redis / bullmq) are mocked out — only the
// pure normalization path is exercised here.
// ============================================================

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/redis", () => ({ getRedisConnection: () => ({}) }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("bullmq", () => ({ Queue: class {}, Worker: class {} }));

import { normalizeWebhookPayload } from "@/lib/banking/webhook-service";

describe("normalizeWebhookPayload", () => {
  it("maps CONSENT_STATUS_UPDATE ACTIVE → CONSENT_APPROVED", () => {
    const payload = {
      type: "CONSENT_STATUS_UPDATE",
      consentId: "consent-1",
      timestamp: new Date().toISOString(),
      data: { status: "ACTIVE" },
    };
    const [event] = normalizeWebhookPayload(payload, JSON.stringify(payload));
    expect(event.eventType).toBe("CONSENT_APPROVED");
    expect(event.consentId).toBe("consent-1");
  });

  it.each([
    ["REJECTED", "CONSENT_REJECTED"],
    ["REVOKED", "CONSENT_REVOKED"],
    ["PAUSED", "CONSENT_PAUSED"],
    ["EXPIRED", "CONSENT_EXPIRED"],
  ])("maps CONSENT_STATUS_UPDATE %s → %s", (status, expected) => {
    const payload = { type: "CONSENT_STATUS_UPDATE", consentId: "c", data: { status } };
    expect(normalizeWebhookPayload(payload, "{}")[0].eventType).toBe(expected);
  });

  it("maps SESSION_STATUS_UPDATE COMPLETED → DATA_READY with session id", () => {
    const payload = {
      type: "SESSION_STATUS_UPDATE",
      consentId: "consent-1",
      dataSessionId: "session-9",
      data: { status: "COMPLETED" },
    };
    const [event] = normalizeWebhookPayload(payload, JSON.stringify(payload));
    expect(event.eventType).toBe("DATA_READY");
    expect(event.dataSessionId).toBe("session-9");
  });

  it("maps SESSION_STATUS_UPDATE FAILED → DATA_FETCH_FAILED", () => {
    const payload = { type: "SESSION_STATUS_UPDATE", data: { status: "FAILED" }, sessionId: "s-2" };
    const [event] = normalizeWebhookPayload(payload, "{}");
    expect(event.eventType).toBe("DATA_FETCH_FAILED");
    expect(event.dataSessionId).toBe("s-2");
  });

  it("passes canonical event names through unchanged", () => {
    for (const type of ["CONSENT_APPROVED", "DATA_READY", "ACCOUNT_LINKED", "ACCOUNT_UNLINKED"]) {
      const [event] = normalizeWebhookPayload({ type, consentId: "c" }, "{}");
      expect(event.eventType).toBe(type);
    }
  });

  it("marks unknown event types as UNKNOWN instead of throwing", () => {
    const [event] = normalizeWebhookPayload({ type: "SOMETHING_ELSE" }, "{}");
    expect(event.eventType).toBe("UNKNOWN");
    expect(event.rawType).toBe("SOMETHING_ELSE");
  });

  it("expands batched notifications[] into individual events", () => {
    const payload = {
      notifications: [
        { type: "CONSENT_STATUS_UPDATE", consentId: "c1", data: { status: "ACTIVE" } },
        { type: "SESSION_STATUS_UPDATE", consentId: "c1", dataSessionId: "s1", data: { status: "COMPLETED" } },
      ],
    };
    const events = normalizeWebhookPayload(payload, JSON.stringify(payload));
    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe("CONSENT_APPROVED");
    expect(events[1].eventType).toBe("DATA_READY");
  });

  it("uses provider notification id as the idempotency key when present", () => {
    const payload = { notificationId: "notif-42", type: "CONSENT_STATUS_UPDATE", data: { status: "ACTIVE" } };
    expect(normalizeWebhookPayload(payload, "{}")[0].externalId).toBe("notif-42");
  });

  it("derives a deterministic hash id when the provider sends none (replay-safe)", () => {
    const payload = { type: "CONSENT_STATUS_UPDATE", consentId: "c", data: { status: "ACTIVE" } };
    const raw = JSON.stringify(payload);
    const a = normalizeWebhookPayload(payload, raw)[0].externalId;
    const b = normalizeWebhookPayload(payload, raw)[0].externalId;
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256:/);
  });

  it("parses timestamps and leaves invalid ones undefined", () => {
    const good = normalizeWebhookPayload(
      { type: "CONSENT_STATUS_UPDATE", data: { status: "ACTIVE" }, timestamp: "2026-06-12T10:00:00Z" },
      "{}"
    )[0];
    expect(good.timestamp).toBeInstanceOf(Date);

    const bad = normalizeWebhookPayload(
      { type: "CONSENT_STATUS_UPDATE", data: { status: "ACTIVE" }, timestamp: "not-a-date" },
      "{}"
    )[0];
    expect(bad.timestamp).toBeUndefined();
  });
});
