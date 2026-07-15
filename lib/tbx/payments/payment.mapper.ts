// ============================================================
// FinRP — TBX Payment mapper
// Normalizes provider results into the VendorPayment update shapes
// payment.service.ts persists.
// ============================================================

import type { InitiatePaymentResult, FetchPaymentStatusResult } from "./payment.types";

export interface PaymentSubmitUpdateData {
  tbxPaymentId: string;
  tbxStatus: string;
  submittedAt: Date;
}

export interface PaymentStatusUpdateData {
  tbxStatus: string;
  tbxUtr?: string;
  failureReason?: string;
}

export function toPaymentUpdateFromInitiate(result: InitiatePaymentResult): PaymentSubmitUpdateData {
  if (result.outcome !== "SUCCESS" || !result.tbxPaymentId) {
    throw new Error("Cannot map a failed InitiatePaymentResult to a VendorPayment update");
  }
  return {
    tbxPaymentId: result.tbxPaymentId,
    tbxStatus: result.status ?? "PROCESSING",
    submittedAt: new Date(),
  };
}

export function toPaymentUpdateFromStatus(result: FetchPaymentStatusResult): PaymentStatusUpdateData {
  if (result.outcome !== "SUCCESS" || !result.status) {
    throw new Error("Cannot map a failed FetchPaymentStatusResult to a VendorPayment update");
  }
  return {
    tbxStatus: result.status,
    tbxUtr: result.utr,
    failureReason: result.failureReason,
  };
}
