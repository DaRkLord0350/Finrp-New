import { describe, it, expect } from "vitest";
import { evaluateEligibility, isEligible, type EvaluateEligibilityInput } from "@/lib/lending/core/eligibility";

const baseInput: EvaluateEligibilityInput = {
  rules: {},
  profile: {},
  requestedAmount: 100_000,
  requestedTenureMonths: 12,
  productMinAmount: 10_000,
  productMaxAmount: 500_000,
  productMinTenureMonths: 6,
  productMaxTenureMonths: 36,
};

describe("evaluateEligibility — amount/tenure bounds (always enforced)", () => {
  it("passes when requested amount and tenure are within the product band", () => {
    const results = evaluateEligibility(baseInput);
    expect(isEligible(results)).toBe(true);
  });

  it("fails when requested amount exceeds the product's max", () => {
    const results = evaluateEligibility({ ...baseInput, requestedAmount: 999_999 });
    const amountCheck = results.find((r) => r.ruleName === "amount_within_product_band");
    expect(amountCheck?.passed).toBe(false);
  });

  it("fails when requested tenure is below the product's min", () => {
    const results = evaluateEligibility({ ...baseInput, requestedTenureMonths: 1 });
    const tenureCheck = results.find((r) => r.ruleName === "tenure_within_product_band");
    expect(tenureCheck?.passed).toBe(false);
  });
});

describe("evaluateEligibility — configurable rules", () => {
  it("evaluates minMonthlyIncome against the profile", () => {
    const results = evaluateEligibility({
      ...baseInput,
      rules: { minMonthlyIncome: 50_000 },
      profile: { monthlyIncome: 40_000 },
    });
    expect(results.find((r) => r.ruleName === "min_monthly_income")?.passed).toBe(false);
  });

  it("evaluates minCreditScore, distinguishing 'not fetched' from 'too low'", () => {
    const notFetched = evaluateEligibility({ ...baseInput, rules: { minCreditScore: 700 }, profile: {} });
    expect(notFetched.find((r) => r.ruleName === "min_credit_score")?.message).toMatch(/not been fetched/);

    const tooLow = evaluateEligibility({ ...baseInput, rules: { minCreditScore: 700 }, profile: { creditScore: 600 } });
    expect(tooLow.find((r) => r.ruleName === "min_credit_score")?.passed).toBe(false);

    const ok = evaluateEligibility({ ...baseInput, rules: { minCreditScore: 700 }, profile: { creditScore: 750 } });
    expect(ok.find((r) => r.ruleName === "min_credit_score")?.passed).toBe(true);
  });

  it("computes maxDebtToIncomeRatio using an estimated EMI from amount/tenure", () => {
    // income 50000, existing obligations 10000, requested 120000 over 12mo -> estimated EMI 10000
    // ratio = (10000+10000)/50000 = 0.4, limit 0.5 -> should pass
    const results = evaluateEligibility({
      ...baseInput,
      requestedAmount: 120_000,
      requestedTenureMonths: 12,
      rules: { maxDebtToIncomeRatio: 0.5 },
      profile: { monthlyIncome: 50_000, existingMonthlyObligations: 10_000 },
    });
    expect(results.find((r) => r.ruleName === "max_debt_to_income_ratio")?.passed).toBe(true);
  });

  it("treats zero income as an infinite (failing) debt-to-income ratio", () => {
    const results = evaluateEligibility({
      ...baseInput,
      rules: { maxDebtToIncomeRatio: 0.5 },
      profile: { monthlyIncome: 0 },
    });
    expect(results.find((r) => r.ruleName === "max_debt_to_income_ratio")?.passed).toBe(false);
  });

  it("evaluates min/max applicant age independently", () => {
    const results = evaluateEligibility({
      ...baseInput,
      rules: { minApplicantAge: 21, maxApplicantAge: 60 },
      profile: { applicantAge: 65 },
    });
    expect(results.find((r) => r.ruleName === "min_applicant_age")?.passed).toBe(true);
    expect(results.find((r) => r.ruleName === "max_applicant_age")?.passed).toBe(false);
  });

  it("flags missing required verified documents by name", () => {
    const results = evaluateEligibility({
      ...baseInput,
      rules: { requiredVerifiedDocuments: ["PAN_CARD", "BANK_STATEMENT"] },
      profile: { verifiedDocumentTypes: ["PAN_CARD"] },
    });
    const check = results.find((r) => r.ruleName === "required_documents_verified");
    expect(check?.passed).toBe(false);
    expect(check?.message).toContain("BANK_STATEMENT");
  });
});

describe("isEligible", () => {
  it("is true only when every check passed", () => {
    expect(isEligible([{ ruleName: "a", passed: true, expectedValue: null, actualValue: null, message: "" }])).toBe(true);
    expect(
      isEligible([
        { ruleName: "a", passed: true, expectedValue: null, actualValue: null, message: "" },
        { ruleName: "b", passed: false, expectedValue: null, actualValue: null, message: "" },
      ])
    ).toBe(false);
  });
});
