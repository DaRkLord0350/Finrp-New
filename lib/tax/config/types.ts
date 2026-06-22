// ============================================================
// lib/tax/config/types.ts
//
// Type contracts for the VERSIONED tax rule engine.
//
// The cardinal rule of the Tax & Compliance Engine: NO computation
// value (rate, slab, limit, threshold, due date) is ever hardcoded in
// business logic. Everything is read from a `TaxRuleSet` resolved for a
// given Financial Year (FY) or Assessment Year (AY) via
// `resolveTaxConfig()` (see loader.ts). Code rule-packs are the default;
// PUBLISHED `TaxConfigVersion` DB rows override them per-org.
// ============================================================

// ── GST ───────────────────────────────────────────────────────
export interface GstConfig {
  /** Valid GST rate slabs (%) for the period. */
  rateSlabs: number[];
  /** Valid cess rates (%) (sparse — most goods have 0). */
  cessSlabs: number[];
  /** Invoice value (₹) at/above which an inter-state B2C invoice is B2CL. */
  b2clThreshold: number;
  /** HSN code digit-length required by aggregate turnover band. */
  hsnDigitsByTurnover: { upToCrore: number; digits: number }[];
  /** Late fee per day (CGST + SGST) for nil / non-nil returns. */
  lateFeePerDay: { nil: number; normal: number; maxCap: number };
  /** Annual interest rate (%) on delayed tax payment. */
  interestRatePct: number;
  /** Statutory due dates (day-of-following-month) by return + frequency. */
  dueDates: {
    gstr1Monthly: number; // 11th
    gstr1Quarterly: number; // 13th of month after quarter
    gstr3bMonthly: number; // 20th
    gstr3bQrmp: number; // 22nd / 24th by state — use 22 default
  };
}

// ── TDS ───────────────────────────────────────────────────────
export interface TdsSectionRule {
  code: string; // "194C"
  name: string;
  rateIndividual: number; // %
  rateOther: number; // %
  rateNoPan: number; // % when deductee has no PAN (usually 20)
  thresholdSingle: number; // ₹ single-payment threshold
  thresholdAnnual: number; // ₹ aggregate threshold
}

export interface TdsConfig {
  sections: TdsSectionRule[];
  /** Monthly interest for late deduction / late deposit (%/month). */
  interest: { lateDeductionPct: number; lateDepositPct: number };
  /** Statutory return + payment due dates. */
  dueDates: { challanDay: number; returnByQuarter: Record<string, string> };
}

// ── Income Tax ─────────────────────────────────────────────────
export interface SlabBand {
  upTo: number | null; // null = no upper bound
  ratePct: number;
}

export interface SurchargeBand {
  aboveIncome: number;
  ratePct: number;
}

export interface IncomeTaxConfig {
  oldRegimeSlabs: SlabBand[];
  newRegimeSlabs: SlabBand[];
  surcharge: SurchargeBand[];
  cessPct: number; // health & education cess (4%)
  rebate87A: { oldLimit: number; newLimit: number; maxRebateOld: number; maxRebateNew: number };
  standardDeduction: { salaried: number };
  deductionLimits: Record<string, number>; // "80C": 150000, "80D": 25000 ...
}

// ── Depreciation (Business Income) ────────────────────────────
export interface DepreciationConfig {
  /** Block name → WDV rate (%) under the IT Act. */
  itActBlocks: Record<string, number>;
  /** Block name → SLM/WDV rate (%) under the Companies Act. */
  companiesActBlocks: Record<string, number>;
}

// ── Capital Gains ─────────────────────────────────────────────
export interface CapitalGainsConfig {
  /** Cost Inflation Index by FY (base 2001-02 = 100). */
  cii: Record<string, number>;
  ltcgEquityRatePct: number;
  ltcgEquityExemption: number; // ₹1,00,000 exemption u/s 112A
  stcgEquityRatePct: number;
  ltcgOtherRatePct: number;
}

// ── Statutory due dates (cross-module rollup) ─────────────────
export interface DueDateConfig {
  itrFilingNonAudit: string; // ISO "MM-DD"
  itrFilingAudit: string;
  taxAuditReport: string;
  advanceTaxInstallments: { day: number; month: number; cumulativePct: number }[];
}

// ── The complete versioned rule set ───────────────────────────
export interface TaxRuleSet {
  /** "FY" period like "2025-26" or "AY" period like "2026-27". */
  period: string;
  /** Which period axis this pack is keyed on. */
  axis: "FY" | "AY";
  gst: GstConfig;
  tds: TdsConfig;
  incomeTax: IncomeTaxConfig;
  depreciation: DepreciationConfig;
  capitalGains: CapitalGainsConfig;
  dueDates: DueDateConfig;
}

/** A deep-partial override payload stored in `TaxConfigVersion.payload`. */
export type TaxRuleSetOverride = DeepPartial<TaxRuleSet>;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<U>
    : T[P] extends object
      ? DeepPartial<T[P]>
      : T[P];
};
