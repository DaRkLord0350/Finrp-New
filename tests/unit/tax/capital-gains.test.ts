// ============================================================
// Unit tests — capital gains (term classification + CII indexation)
// ============================================================

import { describe, it, expect } from "vitest";
import { classifyTerm, computeGain } from "@/lib/tax/capital-gains/service";
import { FY_2025_26 } from "@/lib/tax/config/packs/fy-2025-26";

const cg = FY_2025_26.capitalGains;

describe("classifyTerm", () => {
  it("equity > 12 months is LTCG", () => {
    expect(classifyTerm("EQUITY_STT", new Date("2024-01-01"), new Date("2025-05-01"))).toBe("LTCG");
    expect(classifyTerm("EQUITY_STT", new Date("2025-01-01"), new Date("2025-05-01"))).toBe("STCG");
  });
  it("property uses a 24-month threshold", () => {
    expect(classifyTerm("PROPERTY", new Date("2022-01-01"), new Date("2025-05-01"))).toBe("LTCG");
    expect(classifyTerm("PROPERTY", new Date("2024-01-01"), new Date("2025-05-01"))).toBe("STCG");
  });
});

describe("computeGain", () => {
  it("equity LTCG taxed at 112A rate (exemption applied at summary)", () => {
    const r = computeGain({ assetType: "EQUITY_STT", purchaseDate: new Date("2023-01-01"), saleDate: new Date("2025-05-01"), purchaseValue: 100000, saleValue: 180000, expenses: 0 }, cg);
    expect(r.term).toBe("LTCG");
    expect(r.rate).toBe(cg.ltcgEquityRatePct);
    expect(r.gain).toBe(80000);
  });

  it("equity STCG taxed at 111A rate", () => {
    const r = computeGain({ assetType: "EQUITY_STT", purchaseDate: new Date("2025-01-01"), saleDate: new Date("2025-05-01"), purchaseValue: 100000, saleValue: 150000, expenses: 0 }, cg);
    expect(r.term).toBe("STCG");
    expect(r.rate).toBe(cg.stcgEquityRatePct);
  });

  it("property LTCG applies CII indexation at 20%", () => {
    // CII: 2018-19 = 280, 2025-26 = 376
    const r = computeGain({ assetType: "PROPERTY", purchaseDate: new Date("2018-06-01"), saleDate: new Date("2025-05-01"), purchaseValue: 1000000, saleValue: 2000000, expenses: 0 }, cg);
    expect(r.term).toBe("LTCG");
    expect(r.rate).toBe(20);
    expect(r.indexedCost).toBeCloseTo((1000000 * 376) / 280, 0);
    expect(r.gain).toBeCloseTo(2000000 - (1000000 * 376) / 280, 0);
  });
});
