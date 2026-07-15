// ============================================================
// FinRP — TBX Payment webhook handler
//
// Signature verification uses the same HMAC-SHA256-over-raw-body
// shared-secret mechanism this codebase already uses for Razorpay
// (see lib/billing/razorpay.ts's verifyWebhookSignature) — this is
// an industry-standard mechanism, not a TBX-specific contract
// detail, so it is implemented for real. Only the header name
// (`x-tbx-signature`) is a placeholder pending TBX's own docs;
// update it there once confirmed, the verification logic itself
// does not need to change.
//
// Required env: TBX_BANKING_WEBHOOK_SECRET
//
// In mock mode there is no real TBX signing secret to test against,
// so verification is skipped — this mirrors every other TBX module's
// mock/real duality (see balance.client.ts's config.mockMode gate).
// ============================================================

import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createBankingLogger } from "@/lib/banking/logger";
import { isTbxBankingMockMode } from "@/lib/tbx/balance/balance.client";
import { finalizePaymentSuccess, finalizePaymentFailure } from "./payment.service";

const log = createBankingLogger("tbx-payment-webhook");

export const TBX_WEBHOOK_SIGNATURE_HEADER = "x-tbx-signature";

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Verify a TBX webhook payload. Fails closed outside mock mode. */
export function verifyTbxPaymentWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (isTbxBankingMockMode()) return true;
  if (!signature) return false;

  const secret = process.env.TBX_BANKING_WEBHOOK_SECRET?.trim();
  if (!secret) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEqualHex(expected, signature);
}

export interface TbxPaymentWebhookPayload {
  tbxPaymentId: string;
  /** Our own VendorPayment.id, echoed back by TBX as the client reference we submitted at initiation. */
  clientReference?: string;
  status: "PROCESSING" | "SUCCESS" | "FAILED";
  utr?: string;
  failureReason?: string;
}

/**
 * Idempotent webhook entrypoint. Looks up the VendorPayment by TBX's own
 * reference (falling back to our client reference), and — critically —
 * trusts ONLY the organizationId on the row we found, never anything the
 * payload itself might claim, before delegating to the same finalizers the
 * poll fallback uses.
 */
export async function handlePaymentWebhook(payload: TbxPaymentWebhookPayload): Promise<{ handled: boolean; reason?: string }> {
  const payment = await prisma.vendorPayment.findFirst({
    where: {
      deletedAt: null,
      OR: [{ tbxPaymentId: payload.tbxPaymentId }, ...(payload.clientReference ? [{ id: payload.clientReference }] : [])],
    },
    select: { id: true, organizationId: true, status: true },
  });

  if (!payment) {
    log.warn("webhook received for unknown payment", { tbxPaymentId: payload.tbxPaymentId, clientReference: payload.clientReference });
    return { handled: false, reason: "Unknown payment reference" };
  }

  const rawResponse = payload as unknown as Prisma.InputJsonValue;

  if (payload.status === "SUCCESS") {
    await finalizePaymentSuccess(payment.organizationId, payment.id, { utr: payload.utr, rawResponse });
  } else if (payload.status === "FAILED") {
    await finalizePaymentFailure(payment.organizationId, payment.id, { reason: payload.failureReason ?? "TBX reported payment failure", rawResponse });
  } else {
    await prisma.vendorPayment.update({ where: { id: payment.id }, data: { tbxStatus: payload.status } }).catch(() => {});
  }

  log.info("webhook processed", { organizationId: payment.organizationId, paymentId: payment.id, status: payload.status });
  return { handled: true };
}
