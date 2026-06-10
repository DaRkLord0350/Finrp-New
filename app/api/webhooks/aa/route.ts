// ============================================================
// FinRP — Account Aggregator Webhook Handler
// Processes Setu AA webhook events with HMAC signature verification.
// POST /api/webhooks/aa
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { processSetuWebhook } from "@/lib/banking/integrations/setu-aa";

const SETU_WEBHOOK_SECRET = process.env.SETU_WEBHOOK_SECRET ?? "";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Verify Setu HMAC signature
  const signature = req.headers.get("x-jws-signature") ?? req.headers.get("x-webhook-signature") ?? "";

  if (SETU_WEBHOOK_SECRET && signature) {
    const expectedSig = createHmac("sha256", SETU_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (!timingSafeCompare(signature, expectedSig)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await processSetuWebhook(payload);
    return NextResponse.json({ received: true });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: "banking", action: "aa-webhook" },
      extra: { payload },
    });
    // Return 200 to prevent Setu from retrying on internal errors
    return NextResponse.json({ received: true, error: "processing_error" });
  }
}

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}
