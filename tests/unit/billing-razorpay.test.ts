// ============================================================
// Unit tests — lib/billing/razorpay.ts (signature verification)
//
// The security core of the payment flow. Verifies that a valid HMAC is
// accepted, a tampered one is rejected, and that verification fails
// closed when no secret is configured.
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import {
  verifyPaymentSignature,
  verifyWebhookSignature,
  isRazorpayConfigured,
} from "@/lib/billing/razorpay";

const PAYMENT_SECRET = "rzp_test_secret_key";
const WEBHOOK_SECRET = "whsec_test_value";

function sign(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

describe("payment signature verification", () => {
  const orderId = "order_ABC123";
  const paymentId = "pay_XYZ789";

  beforeEach(() => {
    process.env.RAZORPAY_KEY_SECRET = PAYMENT_SECRET;
  });
  afterEach(() => {
    delete process.env.RAZORPAY_KEY_SECRET;
  });

  it("accepts a correctly signed payment", () => {
    const signature = sign(PAYMENT_SECRET, `${orderId}|${paymentId}`);
    expect(verifyPaymentSignature({ orderId, paymentId, signature })).toBe(true);
  });

  it("rejects a tampered signature", () => {
    const signature = sign(PAYMENT_SECRET, `${orderId}|${paymentId}`);
    expect(
      verifyPaymentSignature({ orderId, paymentId, signature: signature.slice(0, -1) + "0" })
    ).toBe(false);
  });

  it("rejects when the payment id is swapped (replay)", () => {
    const signature = sign(PAYMENT_SECRET, `${orderId}|${paymentId}`);
    expect(
      verifyPaymentSignature({ orderId, paymentId: "pay_OTHER", signature })
    ).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    const signature = sign("wrong_secret", `${orderId}|${paymentId}`);
    expect(verifyPaymentSignature({ orderId, paymentId, signature })).toBe(false);
  });

  it("fails closed when no secret is configured", () => {
    delete process.env.RAZORPAY_KEY_SECRET;
    const signature = sign(PAYMENT_SECRET, `${orderId}|${paymentId}`);
    expect(verifyPaymentSignature({ orderId, paymentId, signature })).toBe(false);
  });
});

describe("webhook signature verification", () => {
  const rawBody = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_1" } } } });

  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });
  afterEach(() => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  it("accepts a correctly signed webhook body", () => {
    expect(verifyWebhookSignature(rawBody, sign(WEBHOOK_SECRET, rawBody))).toBe(true);
  });

  it("rejects when the body is modified after signing", () => {
    const signature = sign(WEBHOOK_SECRET, rawBody);
    expect(verifyWebhookSignature(rawBody + " ", signature)).toBe(false);
  });

  it("rejects a body signed with the wrong secret", () => {
    expect(verifyWebhookSignature(rawBody, sign("nope", rawBody))).toBe(false);
  });

  it("fails closed when no webhook secret is configured", () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    expect(verifyWebhookSignature(rawBody, sign(WEBHOOK_SECRET, rawBody))).toBe(false);
  });
});

describe("configuration check", () => {
  afterEach(() => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
  });

  it("reports configured only when both id + secret are present", () => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    expect(isRazorpayConfigured()).toBe(false);
    process.env.RAZORPAY_KEY_ID = "rzp_test_id";
    expect(isRazorpayConfigured()).toBe(false);
    process.env.RAZORPAY_KEY_SECRET = "secret";
    expect(isRazorpayConfigured()).toBe(true);
  });
});
