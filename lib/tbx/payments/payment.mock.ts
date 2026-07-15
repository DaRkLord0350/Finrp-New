// ============================================================
// FinRP — MockTbxPaymentProvider
//
// Deterministic canned payment lifecycle responses for
// development/tests, since TBX has provided no sandbox credentials
// or test environment for its Payments API. Mirrors
// lib/tbx/beneficiaries/beneficiary.mock.ts's convention, including
// the "identifier ending in 0 fails" deliberate-failure test hook.
// ============================================================

import type {
  InitiatePaymentInput,
  InitiatePaymentResult,
  FetchPaymentStatusInput,
  FetchPaymentStatusResult,
  TbxPaymentProvider,
} from "./payment.types";

function mockTbxPaymentId(clientReference: string): string {
  return `MOCK-PAY-${clientReference.slice(-10).toUpperCase()}`;
}

function mockUtr(tbxPaymentId: string): string {
  return `MOCKUTR${tbxPaymentId.replace(/[^A-Z0-9]/g, "").slice(-10)}`;
}

export class MockTbxPaymentProvider implements TbxPaymentProvider {
  readonly name = "TBX_PAYMENT_MOCK" as const;

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const tbxPaymentId = mockTbxPaymentId(input.clientReference);
    return {
      outcome: "SUCCESS",
      tbxPaymentId,
      status: "PROCESSING",
      raw: {
        mock: true,
        clientReference: input.clientReference,
        tbxPaymentId,
        amount: input.amount,
        paymentType: input.paymentType,
        status: "PROCESSING",
        submittedAt: new Date().toISOString(),
      },
    };
  }

  async fetchPaymentStatus(input: FetchPaymentStatusInput): Promise<FetchPaymentStatusResult> {
    const willFail = /0$/.test(input.tbxPaymentId.trim());

    if (willFail) {
      return {
        outcome: "SUCCESS",
        status: "FAILED",
        failureReason: "Beneficiary account could not be credited (mock failure)",
        raw: { mock: true, tbxPaymentId: input.tbxPaymentId, status: "FAILED" },
      };
    }

    return {
      outcome: "SUCCESS",
      status: "SUCCESS",
      utr: mockUtr(input.tbxPaymentId),
      raw: { mock: true, tbxPaymentId: input.tbxPaymentId, status: "SUCCESS" },
    };
  }
}
