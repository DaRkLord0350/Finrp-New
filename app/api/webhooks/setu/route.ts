// ============================================================
// FinRP — Setu Account Aggregator Webhook
// POST /api/webhooks/setu
//
// Register this URL in Setu's Bridge dashboard. Pipeline:
//   1. HMAC-SHA256 signature verification (timing-safe)
//   2. Replay protection (timestamp window in webhook-service)
//   3. Idempotent storage (BankWebhookEvent.externalId unique)
//   4. Event routing (consent lifecycle / data-ready syncs)
//
// Always returns 200 after a valid signature so Setu doesn't
// retry on internal failures — events are stored and inspectable
// in BankWebhookEvent either way.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getBankingProvider } from "@/lib/banking/providers";
import { processBankWebhook } from "@/lib/banking/webhook-service";
import { createBankingLogger } from "@/lib/banking/logger";

const log = createBankingLogger("webhook.setu");

const SIGNATURE_HEADERS = ["x-setu-signature", "x-jws-signature", "x-webhook-signature"];

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  let signature: string | null = null;
  for (const header of SIGNATURE_HEADERS) {
    signature = req.headers.get(header);
    if (signature) break;
  }

  let verification: { valid: boolean; reason?: string };
  try {
    verification = getBankingProvider("SETU").verifyWebhook(rawBody, signature);
  } catch (err) {
    // Setu env vars missing — never process unverifiable webhooks.
    log.error("webhook rejected: Setu not configured", { error: String(err) });
    return NextResponse.json({ error: "Provider not configured" }, { status: 503 });
  }

  if (!verification.valid) {
    log.warn("webhook rejected: invalid signature", { reason: verification.reason });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await processBankWebhook({
      rawBody,
      payload,
      signature,
      signatureValid: verification.reason !== "sandbox-unsigned",
    });
    log.info("webhook handled", result);
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "setu-webhook" } });
    log.error("webhook processing crashed", { error: String(err) });
    // 200 by design — the event store has the payload for replay/inspection.
    return NextResponse.json({ received: true, error: "processing_error" });
  }
}
