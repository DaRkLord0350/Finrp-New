// ============================================================
// POST /api/webhooks/razorpay — Razorpay webhook receiver
//
// SECURITY: the raw body is HMAC-verified against RAZORPAY_WEBHOOK_SECRET
// before anything is trusted. This is an INDEPENDENT activation path —
// if the customer closes the tab after paying, the webhook still
// captures the payment and activates the plan. Idempotent on order id.
//
// This route is public (see middleware) and authorised purely by the
// signature; it never reads the session.
// ============================================================

import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/billing/razorpay";
import { captureByOrderId, markFailedByOrderId } from "@/lib/services/billing.service";

export const dynamic = "force-dynamic";

interface RazorpayEntity {
  id?: string;
  order_id?: string;
  method?: string;
  error_description?: string;
}
interface RazorpayWebhook {
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayEntity };
    order?: { entity?: RazorpayEntity };
  };
}

export async function POST(req: Request) {
  const signature = req.headers.get("x-razorpay-signature");
  const rawBody = await req.text();

  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: RazorpayWebhook;
  try {
    event = JSON.parse(rawBody) as RazorpayWebhook;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const payment = event.payload?.payment?.entity;
    const order = event.payload?.order?.entity;

    switch (event.event) {
      case "payment.captured":
      case "order.paid": {
        const orderId = payment?.order_id ?? order?.id;
        if (orderId) {
          await captureByOrderId({
            razorpayOrderId: orderId,
            razorpayPaymentId: payment?.id ?? null,
            method: payment?.method ?? null,
          });
        }
        break;
      }
      case "payment.failed": {
        const orderId = payment?.order_id;
        if (orderId) await markFailedByOrderId(orderId, payment?.error_description ?? "Payment failed");
        break;
      }
      default:
        // Unhandled event — acknowledge so Razorpay stops retrying.
        break;
    }
  } catch (err) {
    console.error("[razorpay webhook]", event.event, err);
    // 500 → Razorpay retries; safe because handlers are idempotent.
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
