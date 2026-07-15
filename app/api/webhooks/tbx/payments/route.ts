// ============================================================
// POST /api/webhooks/tbx/payments — TBX payment status webhook
//
// SECURITY: the raw body is HMAC-verified against
// TBX_BANKING_WEBHOOK_SECRET before anything is trusted (mirrors
// /api/webhooks/razorpay exactly). This route is public (see
// middleware.ts's "/api/webhooks(.*)" allowlist) and authorised
// purely by the signature; it never reads the session. Idempotent —
// see payment.service.ts's finalizePaymentSuccess/Failure, which
// no-op on a payment already in a terminal state.
// ============================================================

import { NextResponse } from "next/server";
import { verifyTbxPaymentWebhookSignature, handlePaymentWebhook, TBX_WEBHOOK_SIGNATURE_HEADER, type TbxPaymentWebhookPayload } from "@/lib/tbx/payments/payment.webhook";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const signature = req.headers.get(TBX_WEBHOOK_SIGNATURE_HEADER);
  const rawBody = await req.text();

  if (!verifyTbxPaymentWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: TbxPaymentWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as TbxPaymentWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!payload.tbxPaymentId || !payload.status) {
    return NextResponse.json({ error: "tbxPaymentId and status are required" }, { status: 400 });
  }

  try {
    const result = await handlePaymentWebhook(payload);
    // Acknowledge even an unknown reference so TBX stops retrying — there
    // is nothing more we can do with a payment id we don't recognize.
    return NextResponse.json({ received: true, handled: result.handled });
  } catch (err) {
    console.error("[tbx payments webhook]", payload.tbxPaymentId, err);
    // 500 → TBX retries; safe because the handler is idempotent.
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }
}
