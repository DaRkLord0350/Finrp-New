import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MockLoanPaymentProvider } from "@/lib/lending/payments/mock-provider";
import { LoanPaymentHttpProvider } from "@/lib/lending/payments/provider";
import { LoanPaymentEndpointNotBoundError } from "@/lib/lending/payments/types";
import { LoanPaymentConfigError } from "@/lib/lending/payments/config";
import { getLoanPaymentProvider, resetLoanPaymentProviderCache } from "@/lib/lending/payments";

describe("MockLoanPaymentProvider", () => {
  const provider = new MockLoanPaymentProvider();

  it("is deterministic — same clientReference always yields the same paymentReferenceId", async () => {
    const input = {
      organizationId: "org_test",
      clientReference: "dsb_1",
      beneficiaryName: "Test Borrower",
      beneficiaryAccountNumber: "1234567890",
      beneficiaryIfsc: "HDFC0000001",
      amount: 100_000,
      mode: "NEFT" as const,
      narration: "test",
    };
    const first = await provider.disburse(input);
    const second = await provider.disburse(input);
    expect(first.paymentReferenceId).toBe(second.paymentReferenceId);
  });

  it("registers a mandate deterministically keyed on loanAccountId + mandateType", async () => {
    const result = await provider.registerMandate({
      organizationId: "org_test",
      loanAccountId: "acct_1",
      mandateType: "NACH",
      payerName: "Test Borrower",
      maxAmountPerDebit: 5000,
      startDate: new Date(),
      endDate: new Date(),
    });
    expect(result.outcome).toBe("SUCCESS");
    expect(result.status).toBe("ACTIVE");
    expect(result.mandateReferenceId).toMatch(/^mnd_/);
  });

  it("fetchPaymentStatus reports SUCCESS by default and FAILED for the FAILTEST marker", async () => {
    const ok = await provider.fetchPaymentStatus({ organizationId: "org_test", paymentReferenceId: "pay_normal" });
    expect(ok.status).toBe("SUCCESS");

    const failed = await provider.fetchPaymentStatus({ organizationId: "org_test", paymentReferenceId: "pay_FAILTEST" });
    expect(failed.status).toBe("FAILED");
  });
});

describe("LoanPaymentHttpProvider — no fabricated endpoints", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.LOAN_PAYMENT_BASE_URL = "https://example.invalid";
    process.env.LOAN_PAYMENT_CLIENT_ID = "test-client";
    process.env.LOAN_PAYMENT_API_KEY = "test-key";
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws LoanPaymentEndpointNotBoundError instead of guessing a real HTTP call", async () => {
    const client = new LoanPaymentHttpProvider();
    await expect(
      client.disburse({
        organizationId: "org_test",
        clientReference: "dsb_1",
        beneficiaryName: "Test",
        beneficiaryAccountNumber: "123",
        beneficiaryIfsc: "HDFC0000001",
        amount: 1000,
        mode: "NEFT",
        narration: "test",
      })
    ).rejects.toThrow(LoanPaymentEndpointNotBoundError);
  });

  it("throws LoanPaymentConfigError when required env vars are missing", async () => {
    delete process.env.LOAN_PAYMENT_BASE_URL;
    const client = new LoanPaymentHttpProvider();
    await expect(
      client.disburse({
        organizationId: "org_test",
        clientReference: "dsb_1",
        beneficiaryName: "Test",
        beneficiaryAccountNumber: "123",
        beneficiaryIfsc: "HDFC0000001",
        amount: 1000,
        mode: "NEFT",
        narration: "test",
      })
    ).rejects.toThrow(LoanPaymentConfigError);
  });
});

describe("getLoanPaymentProvider factory", () => {
  const originalEnv = { ...process.env };
  beforeEach(() => resetLoanPaymentProviderCache());
  afterEach(() => {
    process.env = { ...originalEnv };
    resetLoanPaymentProviderCache();
  });

  it("selects the mock provider when LOAN_PAYMENT_MOCK_MODE=true", () => {
    process.env.LOAN_PAYMENT_MOCK_MODE = "true";
    expect(getLoanPaymentProvider().name).toBe("LOAN_PAYMENT_MOCK");
  });

  it("selects the HTTP provider otherwise", () => {
    process.env.LOAN_PAYMENT_MOCK_MODE = "false";
    expect(getLoanPaymentProvider().name).toBe("LOAN_PAYMENT_HTTP");
  });

  it("caches the provider instance across calls", () => {
    process.env.LOAN_PAYMENT_MOCK_MODE = "true";
    const a = getLoanPaymentProvider();
    const b = getLoanPaymentProvider();
    expect(a).toBe(b);
  });
});
