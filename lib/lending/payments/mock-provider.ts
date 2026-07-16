// ============================================================
// lib/lending/payments/mock-provider.ts
// Deterministic fake responses — mirrors lib/tbx/mock-provider.ts.
// Same input always yields the same output so tests and demos are
// reproducible; nothing here is randomized.
// ============================================================

import { createHash } from "crypto";
import type {
  LoanPaymentProvider,
  DisburseInput,
  DisburseResult,
  RegisterMandateInput,
  RegisterMandateResult,
  CancelMandateInput,
  CancelMandateResult,
  CollectViaMandateInput,
  CollectViaMandateResult,
  FetchPaymentStatusInput,
  FetchPaymentStatusResult,
} from "./types";

function deterministicId(prefix: string, seed: string): string {
  return `${prefix}_${createHash("sha256").update(seed).digest("hex").slice(0, 16)}`;
}

export class MockLoanPaymentProvider implements LoanPaymentProvider {
  readonly name = "LOAN_PAYMENT_MOCK" as const;

  async disburse(input: DisburseInput): Promise<DisburseResult> {
    const paymentReferenceId = deterministicId("dsb", input.clientReference);
    return {
      outcome: "SUCCESS",
      paymentReferenceId,
      status: "PROCESSING",
      raw: { mock: true, clientReference: input.clientReference, amount: input.amount, mode: input.mode },
    };
  }

  async registerMandate(input: RegisterMandateInput): Promise<RegisterMandateResult> {
    const mandateReferenceId = deterministicId("mnd", `${input.loanAccountId}:${input.mandateType}`);
    return {
      outcome: "SUCCESS",
      mandateReferenceId,
      status: "ACTIVE",
      raw: { mock: true, loanAccountId: input.loanAccountId, mandateType: input.mandateType },
    };
  }

  async cancelMandate(input: CancelMandateInput): Promise<CancelMandateResult> {
    return {
      outcome: "SUCCESS",
      status: "CANCELLED",
      raw: { mock: true, mandateReferenceId: input.mandateReferenceId },
    };
  }

  async collectViaMandate(input: CollectViaMandateInput): Promise<CollectViaMandateResult> {
    const paymentReferenceId = deterministicId("col", input.clientReference);
    return {
      outcome: "SUCCESS",
      paymentReferenceId,
      status: "PROCESSING",
      raw: { mock: true, clientReference: input.clientReference, amount: input.amount },
    };
  }

  async fetchPaymentStatus(input: FetchPaymentStatusInput): Promise<FetchPaymentStatusResult> {
    // Deterministically SUCCESS unless the caller's reference hashes to a
    // reserved "always fail" test marker (paymentReferenceId containing
    // "FAILTEST"), so failure/bounce paths remain testable on demand.
    if (input.paymentReferenceId.includes("FAILTEST")) {
      return { outcome: "SUCCESS", status: "FAILED", failureReason: "Mock forced failure", raw: { mock: true } };
    }
    return {
      outcome: "SUCCESS",
      status: "SUCCESS",
      utrNumber: deterministicId("utr", input.paymentReferenceId),
      raw: { mock: true, paymentReferenceId: input.paymentReferenceId },
    };
  }
}
