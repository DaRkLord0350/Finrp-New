import { describe, it, expect } from "vitest";
import { FATF_BLACKLIST_SEED, OCCUPATION_RISK_SEED, INDUSTRY_RISK_SEED, defaultRiskLevelForUnknown } from "@/lib/aml/core/risk-factors";

describe("risk factor seed data", () => {
  it("FATF blacklist entries all carry HIGH or CRITICAL risk", () => {
    for (const entry of FATF_BLACKLIST_SEED) {
      expect(["HIGH", "CRITICAL"]).toContain(entry.riskLevel);
    }
  });

  it("occupation and industry seeds have unique codes (no duplicate ratings)", () => {
    const occCodes = OCCUPATION_RISK_SEED.map((o) => o.code);
    expect(new Set(occCodes).size).toBe(occCodes.length);
    const indCodes = INDUSTRY_RISK_SEED.map((i) => i.code);
    expect(new Set(indCodes).size).toBe(indCodes.length);
  });

  it("PEP-adjacent occupations (government/judiciary/military) are all HIGH risk", () => {
    const peP = OCCUPATION_RISK_SEED.filter((o) => ["GOVERNMENT_OFFICIAL", "JUDICIARY", "MILITARY_SENIOR"].includes(o.code));
    expect(peP.every((o) => o.riskLevel === "HIGH")).toBe(true);
  });

  it("money-service and casino industries are CRITICAL risk (highest cash-intensive tier)", () => {
    const critical = INDUSTRY_RISK_SEED.filter((i) => ["MONEY_SERVICE_BUSINESS", "CASINO_GAMING"].includes(i.code));
    expect(critical.every((i) => i.riskLevel === "CRITICAL")).toBe(true);
  });

  it("defaultRiskLevelForUnknown never returns LOW (unknown != safe)", () => {
    expect(defaultRiskLevelForUnknown()).not.toBe("LOW");
  });
});
