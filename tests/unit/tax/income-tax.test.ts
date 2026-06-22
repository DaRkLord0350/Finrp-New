// ============================================================
// Unit tests — income-tax computation (slabs, regime comparison)
// ============================================================

import { describe, it, expect } from "vitest";
import { slabTax, computeRegime, compareRegimes, suggestItrForm, type IncomeInput } from "@/lib/tax/income-tax/compute";
import { FY_2025_26 } from "@/lib/tax/config/packs/fy-2025-26";

const cfg = FY_2025_26.incomeTax;

function input(over: Partial<IncomeInput> = {}): IncomeInput {
  return { salary: 0, houseProperty: 0, business: 0, capitalGains: 0, other: 0, deductions: {}, isSalaried: true, advanceTaxPaid: 0, tdsCredit: 0, ...over };
}

describe("slabTax", () => {
  it("computes progressive new-regime tax", () => {
    // 0-4L:0, 4-8L:5%=20000, 8-12L:10% on 400000=40000 ⇒ 60000
    expect(slabTax(1200000, cfg.newRegimeSlabs)).toBe(60000);
  });
  it("is zero below the basic exemption", () => {
    expect(slabTax(350000, cfg.newRegimeSlabs)).toBe(0);
  });
});

describe("computeRegime", () => {
  it("new regime: salary 12L is fully rebated (87A)", () => {
    const r = computeRegime(input({ salary: 1200000 }), cfg, "NEW");
    expect(r.standardDeduction).toBe(75000);
    expect(r.taxableIncome).toBe(1125000);
    expect(r.rebate87A).toBeGreaterThan(0);
    expect(r.totalTax).toBe(0);
  });

  it("old regime: deductions reduce tax but no rebate above 5L", () => {
    const r = computeRegime(input({ salary: 1200000, deductions: { "80C": 150000, "80D": 25000 } }), cfg, "OLD");
    expect(r.totalDeductions).toBe(250000); // 75000 std + 150000 + 25000
    expect(r.taxableIncome).toBe(950000);
    expect(r.totalTax).toBeGreaterThan(0);
  });

  it("caps 80C at the configured limit", () => {
    const r = computeRegime(input({ salary: 2000000, deductions: { "80C": 500000 } }), cfg, "OLD");
    // 80C capped at 150000 (+ 75000 std) = 225000
    expect(r.totalDeductions).toBe(225000);
  });
});

describe("compareRegimes + ITR selection", () => {
  it("recommends the cheaper regime", () => {
    const cmp = compareRegimes(input({ salary: 1200000, deductions: { "80C": 150000, "80D": 25000 } }), cfg);
    expect(cmp.recommended).toBe("NEW");
    expect(cmp.new.totalTax).toBeLessThanOrEqual(cmp.old.totalTax);
    expect(cmp.saving).toBe(Math.abs(cmp.old.totalTax - cmp.new.totalTax));
  });

  it("selects ITR form by income composition", () => {
    expect(suggestItrForm(input({ salary: 800000 }))).toBe("ITR1");
    expect(suggestItrForm(input({ salary: 800000, capitalGains: 50000 }))).toBe("ITR2");
    expect(suggestItrForm(input({ business: 1000000 }))).toBe("ITR3");
  });
});
