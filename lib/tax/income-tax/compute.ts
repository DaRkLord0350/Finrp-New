// ============================================================
// lib/tax/income-tax/compute.ts
//
// Pure income-tax computation. Three clean layers per the spec:
//   • TAX RULES      — slab tax, surcharge, cess, rebate (here)
//   • VALIDATION     — lib/tax/validation (separate)
//   • JSON GENERATION — buildItrPayload (here)
//
// All rates/slabs/limits come from the versioned IncomeTaxConfig — no
// values are hardcoded in this file.
// ============================================================

import type { IncomeTaxConfig, SlabBand } from "../config/types";

export type Regime = "OLD" | "NEW";

export interface IncomeInput {
  salary: number;
  houseProperty: number;
  business: number;
  capitalGains: number;
  other: number;
  /** Claimed deductions by code, e.g. { "80C": 150000, "80D": 25000 }. */
  deductions: Record<string, number>;
  isSalaried: boolean;
  advanceTaxPaid: number;
  tdsCredit: number;
}

export interface RegimeResult {
  regime: Regime;
  grossTotalIncome: number;
  standardDeduction: number;
  chapterViADeductions: number;
  totalDeductions: number;
  taxableIncome: number;
  taxBeforeRebate: number;
  rebate87A: number;
  surcharge: number;
  cess: number;
  totalTax: number;
  netPayable: number;
  refundDue: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const r0 = (n: number) => Math.round(n);

/** Progressive slab tax. */
export function slabTax(taxableIncome: number, slabs: SlabBand[]): number {
  let tax = 0;
  let lower = 0;
  for (const band of slabs) {
    const upper = band.upTo ?? Number.POSITIVE_INFINITY;
    if (taxableIncome > lower) {
      const slice = Math.min(taxableIncome, upper) - lower;
      tax += (slice * band.ratePct) / 100;
    }
    lower = upper;
    if (taxableIncome <= upper) break;
  }
  return r2(tax);
}

/** Surcharge on tax, based on total income bands (highest applicable rate). */
export function surcharge(tax: number, totalIncome: number, config: IncomeTaxConfig): number {
  let rate = 0;
  for (const band of config.surcharge) {
    if (totalIncome > band.aboveIncome) rate = band.ratePct;
  }
  return r2((tax * rate) / 100);
}

/** Chapter VI-A deductions allowed for a regime, capped by config limits. */
function chapterViA(input: IncomeInput, config: IncomeTaxConfig, regime: Regime): number {
  // New regime disallows most Chapter VI-A deductions.
  if (regime === "NEW") return 0;
  let total = 0;
  for (const [code, claimed] of Object.entries(input.deductions)) {
    const limit = config.deductionLimits[code] ?? 0;
    total += Math.min(claimed, limit === Number.POSITIVE_INFINITY ? claimed : limit);
  }
  return r2(total);
}

/** Full computation for one regime. */
export function computeRegime(input: IncomeInput, config: IncomeTaxConfig, regime: Regime): RegimeResult {
  const gti = input.salary + input.houseProperty + input.business + input.capitalGains + input.other;

  const stdDeduction = input.isSalaried && input.salary > 0 ? Math.min(config.standardDeduction.salaried, input.salary) : 0;
  const chapVia = chapterViA(input, config, regime);
  const totalDeductions = stdDeduction + chapVia;
  const taxableIncome = Math.max(0, gti - totalDeductions);

  const slabs = regime === "OLD" ? config.oldRegimeSlabs : config.newRegimeSlabs;
  const taxBeforeRebate = slabTax(taxableIncome, slabs);

  // Section 87A rebate.
  const rebateLimit = regime === "OLD" ? config.rebate87A.oldLimit : config.rebate87A.newLimit;
  const rebateCap = regime === "OLD" ? config.rebate87A.maxRebateOld : config.rebate87A.maxRebateNew;
  const rebate = taxableIncome <= rebateLimit ? Math.min(taxBeforeRebate, rebateCap) : 0;

  const taxAfterRebate = Math.max(0, taxBeforeRebate - rebate);
  const sur = surcharge(taxAfterRebate, taxableIncome, config);
  const cess = r2(((taxAfterRebate + sur) * config.cessPct) / 100);
  const totalTax = r0(taxAfterRebate + sur + cess);

  const credits = input.advanceTaxPaid + input.tdsCredit;
  const netPayable = Math.max(0, totalTax - credits);
  const refundDue = Math.max(0, credits - totalTax);

  return {
    regime,
    grossTotalIncome: r2(gti),
    standardDeduction: r2(stdDeduction),
    chapterViADeductions: r2(chapVia),
    totalDeductions: r2(totalDeductions),
    taxableIncome: r2(taxableIncome),
    taxBeforeRebate,
    rebate87A: r2(rebate),
    surcharge: sur,
    cess,
    totalTax,
    netPayable,
    refundDue,
  };
}

export interface RegimeComparison {
  old: RegimeResult;
  new: RegimeResult;
  recommended: Regime;
  saving: number;
}

/** Compute both regimes and recommend the cheaper one. */
export function compareRegimes(input: IncomeInput, config: IncomeTaxConfig): RegimeComparison {
  const oldR = computeRegime(input, config, "OLD");
  const newR = computeRegime(input, config, "NEW");
  const recommended: Regime = newR.totalTax <= oldR.totalTax ? "NEW" : "OLD";
  return { old: oldR, new: newR, recommended, saving: Math.abs(oldR.totalTax - newR.totalTax) };
}

/** Heuristic ITR form selection. */
export function suggestItrForm(input: IncomeInput): "ITR1" | "ITR2" | "ITR3" | "ITR4" {
  if (input.business > 0) return "ITR3";
  if (input.capitalGains > 0) return "ITR2";
  const gti = input.salary + input.houseProperty + input.business + input.capitalGains + input.other;
  if (gti <= 5000000 && input.houseProperty >= 0) return "ITR1";
  return "ITR2";
}

/** Government-shaped ITR computation JSON (layer 3). */
export function buildItrPayload(input: IncomeInput, result: RegimeResult, assessmentYear: string, form: string) {
  return {
    assessmentYear,
    form,
    regime: result.regime,
    partB_TI: {
      salaries: r0(input.salary),
      houseProperty: r0(input.houseProperty),
      businessProfession: r0(input.business),
      capitalGains: r0(input.capitalGains),
      otherSources: r0(input.other),
      grossTotalIncome: r0(result.grossTotalIncome),
      deductionsViA: r0(result.totalDeductions),
      totalIncome: r0(result.taxableIncome),
    },
    partB_TTI: {
      taxOnTotalIncome: r0(result.taxBeforeRebate),
      rebate87A: r0(result.rebate87A),
      surcharge: r0(result.surcharge),
      healthEduCess: r0(result.cess),
      totalTaxLiability: r0(result.totalTax),
      advanceTax: r0(input.advanceTaxPaid),
      tds: r0(input.tdsCredit),
      taxPayable: r0(result.netPayable),
      refund: r0(result.refundDue),
    },
  };
}
