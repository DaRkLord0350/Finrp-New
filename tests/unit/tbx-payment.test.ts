// ============================================================
// Unit tests — lib/tbx/payments/*
// Mock provider determinism, mapper correctness, the real client's
// "no fabricated endpoints" guarantee, and webhook signature
// verification (Phase 2D).
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { MockTbxPaymentProvider } from "@/lib/tbx/payments/payment.mock";
import { TbxPaymentHttpClient } from "@/lib/tbx/payments/payment.client";
import { TbxPaymentEndpointNotBoundError } from "@/lib/tbx/payments/payment.types";
import { toPaymentUpdateFromInitiate, toPaymentUpdateFromStatus } from "@/lib/tbx/payments/payment.mapper";
import { verifyTbxPaymentWebhookSignature, TBX_WEBHOOK_SIGNATURE_HEADER } from "@/lib/tbx/payments/payment.webhook";

describe("MockTbxPaymentProvider", () => {
  it("initiates a payment in PROCESSING status", async () => {
    const provider = new MockTbxPaymentProvider();
    const result = await provider.initiatePayment({
      organizationId: "org_test",
      clientReference: "payment_test_123",
      beneficiaryTbxId: "MOCK-BEN-123",
      amount: 50000,
      paymentType: "NEFT",
      narration: "Test payment",
    });

    expect(result.outcome).toBe("SUCCESS");
    expect(result.tbxPaymentId).toBeTruthy();
    expect(result.status).toBe("PROCESSING");
  });

  it("resolves SUCCESS for a payment id not ending in 0", async () => {
    const provider = new MockTbxPaymentProvider();
    const result = await provider.fetchPaymentStatus({ organizationId: "org_test", tbxPaymentId: "MOCK-PAY-0000000123" });
    expect(result.status).toBe("SUCCESS");
    expect(result.utr).toBeTruthy();
  });

  it("deliberately resolves FAILED for a payment id ending in 0 (test hook)", async () => {
    const provider = new MockTbxPaymentProvider();
    const result = await provider.fetchPaymentStatus({ organizationId: "org_test", tbxPaymentId: "MOCK-PAY-0000000120" });
    expect(result.status).toBe("FAILED");
    expect(result.failureReason).toBeTruthy();
  });
});

describe("payment mapper", () => {
  it("maps a successful initiate result to a submit update", async () => {
    const provider = new MockTbxPaymentProvider();
    const result = await provider.initiatePayment({
      organizationId: "org_test",
      clientReference: "payment_test_123",
      beneficiaryTbxId: "MOCK-BEN-123",
      amount: 50000,
      paymentType: "NEFT",
      narration: "Test payment",
    });
    const update = toPaymentUpdateFromInitiate(result);
    expect(update.tbxPaymentId).toBe(result.tbxPaymentId);
    expect(update.submittedAt).toBeInstanceOf(Date);
  });

  it("maps a successful status result to a status update", async () => {
    const provider = new MockTbxPaymentProvider();
    const result = await provider.fetchPaymentStatus({ organizationId: "org_test", tbxPaymentId: "MOCK-PAY-0000000123" });
    const update = toPaymentUpdateFromStatus(result);
    expect(update.tbxStatus).toBe("SUCCESS");
    expect(update.tbxUtr).toBeTruthy();
  });

  it("refuses to map a failed result", () => {
    expect(() => toPaymentUpdateFromInitiate({ outcome: "FAILED", raw: null })).toThrow();
    expect(() => toPaymentUpdateFromStatus({ outcome: "FAILED", raw: null })).toThrow();
  });
});

describe("TbxPaymentHttpClient — no fabricated endpoints", () => {
  it("throws TbxPaymentEndpointNotBoundError instead of guessing a real HTTP call", async () => {
    const client = new TbxPaymentHttpClient();
    await expect(
      client.initiatePayment({ organizationId: "org_test", clientReference: "payment_test_123", beneficiaryTbxId: "MOCK-BEN-123", amount: 1000, paymentType: "NEFT", narration: "x" })
    ).rejects.toThrow(TbxPaymentEndpointNotBoundError);
    await expect(
      client.fetchPaymentStatus({ organizationId: "org_test", tbxPaymentId: "MOCK-PAY-1" })
    ).rejects.toThrow(TbxPaymentEndpointNotBoundError);
  });
});

describe("TBX payment webhook signature verification", () => {
  const ORIGINAL_MOCK_MODE = process.env.TBX_BANKING_MOCK_MODE;
  const ORIGINAL_SECRET = process.env.TBX_BANKING_WEBHOOK_SECRET;

  afterEach(() => {
    process.env.TBX_BANKING_MOCK_MODE = ORIGINAL_MOCK_MODE;
    process.env.TBX_BANKING_WEBHOOK_SECRET = ORIGINAL_SECRET;
  });

  it("skips verification in mock mode", () => {
    process.env.TBX_BANKING_MOCK_MODE = "true";
    expect(verifyTbxPaymentWebhookSignature('{"any":"payload"}', null)).toBe(true);
  });

  describe("outside mock mode", () => {
    beforeEach(() => {
      process.env.TBX_BANKING_MOCK_MODE = "false";
      process.env.TBX_BANKING_WEBHOOK_SECRET = "test-secret";
    });

    it("accepts a correctly-signed payload", () => {
      const rawBody = JSON.stringify({ tbxPaymentId: "MOCK-PAY-1", status: "SUCCESS" });
      const signature = crypto.createHmac("sha256", "test-secret").update(rawBody).digest("hex");
      expect(verifyTbxPaymentWebhookSignature(rawBody, signature)).toBe(true);
    });

    it("rejects a payload with no signature", () => {
      const rawBody = JSON.stringify({ tbxPaymentId: "MOCK-PAY-1", status: "SUCCESS" });
      expect(verifyTbxPaymentWebhookSignature(rawBody, null)).toBe(false);
    });

    it("rejects a payload with a tampered signature", () => {
      const rawBody = JSON.stringify({ tbxPaymentId: "MOCK-PAY-1", status: "SUCCESS" });
      const wrongSignature = crypto.createHmac("sha256", "wrong-secret").update(rawBody).digest("hex");
      expect(verifyTbxPaymentWebhookSignature(rawBody, wrongSignature)).toBe(false);
    });

    it("rejects when the webhook secret is not configured", () => {
      delete process.env.TBX_BANKING_WEBHOOK_SECRET;
      const rawBody = JSON.stringify({ tbxPaymentId: "MOCK-PAY-1", status: "SUCCESS" });
      const signature = crypto.createHmac("sha256", "test-secret").update(rawBody).digest("hex");
      expect(verifyTbxPaymentWebhookSignature(rawBody, signature)).toBe(false);
    });
  });

  it("exposes the expected signature header name", () => {
    expect(TBX_WEBHOOK_SIGNATURE_HEADER).toBe("x-tbx-signature");
  });
});
