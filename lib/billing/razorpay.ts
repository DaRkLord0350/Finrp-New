// ============================================================
// lib/billing/razorpay.ts
//
// Dependency-free Razorpay integration: Orders are created via the
// REST API and all signatures are verified with node:crypto. No SDK,
// no extra npm dependency.
//
// SECURITY: payment + webhook signatures are verified server-side with
// timing-safe comparison. The client-reported payment result is NEVER
// trusted — only a valid signature (or a verified webhook) activates a
// plan.
//
// Required env:
//   RAZORPAY_KEY_ID            — API key id (server)
//   RAZORPAY_KEY_SECRET        — API key secret (server, never exposed)
//   RAZORPAY_WEBHOOK_SECRET    — webhook signing secret
//   NEXT_PUBLIC_RAZORPAY_KEY_ID — key id for the browser Checkout (falls
//                                 back to RAZORPAY_KEY_ID)
// ============================================================

import crypto from "node:crypto";

const ORDERS_ENDPOINT = "https://api.razorpay.com/v1/orders";
const PAYMENTS_ENDPOINT = "https://api.razorpay.com/v1/payments";

function keyId(): string | undefined {
  return process.env.RAZORPAY_KEY_ID?.trim();
}
function keySecret(): string | undefined {
  return process.env.RAZORPAY_KEY_SECRET?.trim();
}
function webhookSecret(): string | undefined {
  return process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
}

/** Public key id for the browser Checkout widget. */
export function getPublicKeyId(): string | undefined {
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() ?? keyId();
}

export function isRazorpayConfigured(): boolean {
  return !!keyId() && !!keySecret();
}

export class RazorpayError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "RazorpayError";
    this.status = status;
  }
}

export interface RazorpayOrder {
  id: string;
  amount: number; // paise
  currency: string;
  receipt?: string;
  status: string;
}

/**
 * Create a Razorpay Order for a one-time/period charge.
 * @param amountRupees integer rupees (converted to paise here)
 */
export async function createRazorpayOrder(params: {
  amountRupees: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const id = keyId();
  const secret = keySecret();
  if (!id || !secret) {
    throw new RazorpayError(
      "Payments are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
      503
    );
  }

  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(ORDERS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(params.amountRupees * 100), // paise
      currency: "INR",
      receipt: params.receipt,
      notes: params.notes ?? {},
      payment_capture: 1,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new RazorpayError(`Razorpay order creation failed: ${res.status} ${text}`);
  }
  return (await res.json()) as RazorpayOrder;
}

/** Fetch a payment (used to enrich webhook/verify with method, etc.). */
export async function fetchRazorpayPayment(
  paymentId: string
): Promise<Record<string, unknown> | null> {
  const id = keyId();
  const secret = keySecret();
  if (!id || !secret) return null;
  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(`${PAYMENTS_ENDPOINT}/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

// ── Signature verification ────────────────────────────────────

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify a Checkout success callback. Razorpay signs
 * `${orderId}|${paymentId}` with the key secret (HMAC-SHA256).
 */
export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = keySecret();
  if (!secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");
  return timingSafeEqualHex(expected, params.signature);
}

/**
 * Verify a webhook payload. Razorpay signs the RAW request body with the
 * webhook secret (HMAC-SHA256) and sends it in `X-Razorpay-Signature`.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = webhookSecret();
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEqualHex(expected, signature);
}
