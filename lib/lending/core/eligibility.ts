// ============================================================
// lib/lending/core/eligibility.ts
//
// Eligibility Engine — evaluates a loan application's requested terms
// and the applicant's financial profile against a LoanProduct's
// configured eligibility rules (LoanProduct.eligibilityRules Json).
// Pure function, no I/O: the caller persists each returned row as a
// LoanEligibilityCheck and decides what to do with an overall FAIL
// (hold the application, auto-reject, or let an underwriter override).
//
// The per-rule pass/fail + message shape is deliberate — it is the
// direct input to the "explain why this loan was rejected" AI
// feature (lib/lending/ai/underwriting.ts): that endpoint summarizes
// these rows in natural language rather than re-deriving them.
// ============================================================

export interface EligibilityRuleSet {
  minMonthlyIncome?: number;
  minCreditScore?: number;
  minBusinessVintageMonths?: number;
  /** Max existing-EMI-to-income ratio, e.g. 0.5 = 50%. */
  maxDebtToIncomeRatio?: number;
  minApplicantAge?: number;
  maxApplicantAge?: number;
  maxActiveLoanCount?: number;
  /** LoanDocumentType values that must be VERIFIED before approval. */
  requiredVerifiedDocuments?: string[];
}

export interface ApplicantFinancialProfile {
  monthlyIncome?: number;
  creditScore?: number;
  businessVintageMonths?: number;
  existingMonthlyObligations?: number;
  applicantAge?: number;
  activeLoanCount?: number;
  verifiedDocumentTypes?: string[];
}

export interface EligibilityCheckResult {
  ruleName: string;
  passed: boolean;
  expectedValue: string | null;
  actualValue: string | null;
  message: string;
}

function check(
  ruleName: string,
  passed: boolean,
  expectedValue: string | number | null,
  actualValue: string | number | null,
  passMessage: string,
  failMessage: string
): EligibilityCheckResult {
  return {
    ruleName,
    passed,
    expectedValue: expectedValue === null ? null : String(expectedValue),
    actualValue: actualValue === null ? null : String(actualValue),
    message: passed ? passMessage : failMessage,
  };
}

export interface EvaluateEligibilityInput {
  rules: EligibilityRuleSet;
  profile: ApplicantFinancialProfile;
  requestedAmount: number;
  requestedTenureMonths: number;
  productMinAmount: number;
  productMaxAmount: number;
  productMinTenureMonths: number;
  productMaxTenureMonths: number;
}

export function evaluateEligibility(input: EvaluateEligibilityInput): EligibilityCheckResult[] {
  const { rules, profile, requestedAmount, requestedTenureMonths } = input;
  const results: EligibilityCheckResult[] = [];

  // Amount / tenure must sit inside the product's own band — always
  // enforced, independent of the configurable rule set.
  results.push(
    check(
      "amount_within_product_band",
      requestedAmount >= input.productMinAmount && requestedAmount <= input.productMaxAmount,
      `${input.productMinAmount} - ${input.productMaxAmount}`,
      requestedAmount,
      "Requested amount is within the product's offered range.",
      "Requested amount falls outside the product's offered range."
    )
  );
  results.push(
    check(
      "tenure_within_product_band",
      requestedTenureMonths >= input.productMinTenureMonths && requestedTenureMonths <= input.productMaxTenureMonths,
      `${input.productMinTenureMonths} - ${input.productMaxTenureMonths} months`,
      `${requestedTenureMonths} months`,
      "Requested tenure is within the product's offered range.",
      "Requested tenure falls outside the product's offered range."
    )
  );

  if (rules.minMonthlyIncome !== undefined) {
    const actual = profile.monthlyIncome ?? 0;
    results.push(
      check(
        "min_monthly_income",
        actual >= rules.minMonthlyIncome,
        rules.minMonthlyIncome,
        actual,
        "Monthly income meets the minimum requirement.",
        "Monthly income is below the minimum requirement."
      )
    );
  }

  if (rules.minCreditScore !== undefined) {
    const actual = profile.creditScore ?? 0;
    results.push(
      check(
        "min_credit_score",
        actual >= rules.minCreditScore,
        rules.minCreditScore,
        profile.creditScore ?? null,
        "Credit score meets the minimum requirement.",
        profile.creditScore === undefined
          ? "Credit score has not been fetched yet."
          : "Credit score is below the minimum requirement."
      )
    );
  }

  if (rules.minBusinessVintageMonths !== undefined) {
    const actual = profile.businessVintageMonths ?? 0;
    results.push(
      check(
        "min_business_vintage",
        actual >= rules.minBusinessVintageMonths,
        `${rules.minBusinessVintageMonths} months`,
        `${actual} months`,
        "Business vintage meets the minimum requirement.",
        "Business vintage is below the minimum requirement."
      )
    );
  }

  if (rules.maxDebtToIncomeRatio !== undefined) {
    const income = profile.monthlyIncome ?? 0;
    const obligations = profile.existingMonthlyObligations ?? 0;
    // Approximate the new EMI's income impact using a straight-line
    // estimate (amount/tenure) — the precise EMI is computed later in
    // the workflow once a rate is offered; this is a pre-screen only.
    const estimatedNewEmi = requestedTenureMonths > 0 ? requestedAmount / requestedTenureMonths : requestedAmount;
    const ratio = income > 0 ? (obligations + estimatedNewEmi) / income : Number.POSITIVE_INFINITY;
    results.push(
      check(
        "max_debt_to_income_ratio",
        ratio <= rules.maxDebtToIncomeRatio,
        `${(rules.maxDebtToIncomeRatio * 100).toFixed(0)}%`,
        Number.isFinite(ratio) ? `${(ratio * 100).toFixed(0)}%` : "undeterminable (no income on file)",
        "Estimated debt-to-income ratio is within the allowed limit.",
        "Estimated debt-to-income ratio exceeds the allowed limit."
      )
    );
  }

  if (rules.minApplicantAge !== undefined) {
    const actual = profile.applicantAge ?? 0;
    results.push(
      check(
        "min_applicant_age",
        actual >= rules.minApplicantAge,
        rules.minApplicantAge,
        profile.applicantAge ?? null,
        "Applicant meets the minimum age requirement.",
        "Applicant is below the minimum age requirement."
      )
    );
  }

  if (rules.maxApplicantAge !== undefined) {
    const actual = profile.applicantAge ?? 0;
    results.push(
      check(
        "max_applicant_age",
        actual === 0 ? true : actual <= rules.maxApplicantAge,
        rules.maxApplicantAge,
        profile.applicantAge ?? null,
        "Applicant is within the maximum age limit.",
        "Applicant exceeds the maximum age limit."
      )
    );
  }

  if (rules.maxActiveLoanCount !== undefined) {
    const actual = profile.activeLoanCount ?? 0;
    results.push(
      check(
        "max_active_loans",
        actual <= rules.maxActiveLoanCount,
        rules.maxActiveLoanCount,
        actual,
        "Number of active loans is within the allowed limit.",
        "Applicant already has too many active loans."
      )
    );
  }

  if (rules.requiredVerifiedDocuments?.length) {
    const verified = new Set(profile.verifiedDocumentTypes ?? []);
    const missing = rules.requiredVerifiedDocuments.filter((doc) => !verified.has(doc));
    results.push(
      check(
        "required_documents_verified",
        missing.length === 0,
        rules.requiredVerifiedDocuments.join(", "),
        [...verified].join(", ") || "none",
        "All required documents are verified.",
        `Missing verified document(s): ${missing.join(", ")}.`
      )
    );
  }

  return results;
}

export function isEligible(results: EligibilityCheckResult[]): boolean {
  return results.every((r) => r.passed);
}
