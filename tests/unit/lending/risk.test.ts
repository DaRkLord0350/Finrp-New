import { describe, it, expect } from "vitest";
import { computeRiskScore, estimateDefaultProbabilityBand } from "@/lib/lending/core/risk";

describe("computeRiskScore", () => {
  it("scores a clean application (full eligibility pass, low utilization) as LOW risk", () => {
    const result = computeRiskScore({ eligibilityPassRate: 1, requestedToMaxAmountRatio: 0.1 });
    expect(result.level).toBe("LOW");
    expect(result.score).toBeLessThan(25);
  });

  it("scores a maxed-out, fully-failed application as CRITICAL risk", () => {
    const result = computeRiskScore({ eligibilityPassRate: 0, requestedToMaxAmountRatio: 1 });
    expect(result.level).toBe("CRITICAL");
    expect(result.score).toBeGreaterThanOrEqual(75);
  });

  it("factor weights always sum to 100% of whatever signals are present", () => {
    const result = computeRiskScore({ eligibilityPassRate: 0.8, requestedToMaxAmountRatio: 0.3, creditScore: 750 });
    const totalWeight = result.factors.reduce((sum, f) => sum + f.weight, 0);
    expect(totalWeight).toBeCloseTo(1, 2);
  });

  it("a strong credit score pulls the overall score down", () => {
    const withGoodCredit = computeRiskScore({ eligibilityPassRate: 0.8, requestedToMaxAmountRatio: 0.3, creditScore: 850 });
    const withBadCredit = computeRiskScore({ eligibilityPassRate: 0.8, requestedToMaxAmountRatio: 0.3, creditScore: 320 });
    expect(withGoodCredit.score).toBeLessThan(withBadCredit.score);
  });

  it("full collateral coverage reduces risk versus no collateral", () => {
    const covered = computeRiskScore({ eligibilityPassRate: 1, requestedToMaxAmountRatio: 0.2, collateralCoverageRatio: 1.5 });
    const uncovered = computeRiskScore({ eligibilityPassRate: 1, requestedToMaxAmountRatio: 0.2, collateralCoverageRatio: 0 });
    expect(covered.score).toBeLessThan(uncovered.score);
  });

  it("clamps the final score into [0, 100]", () => {
    const result = computeRiskScore({ eligibilityPassRate: 0, requestedToMaxAmountRatio: 5, fraudScore: 500 });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe("estimateDefaultProbabilityBand", () => {
  it("bands scores at the documented thresholds", () => {
    expect(estimateDefaultProbabilityBand(0).band).toBe("LOW");
    expect(estimateDefaultProbabilityBand(24).band).toBe("LOW");
    expect(estimateDefaultProbabilityBand(25).band).toBe("MODERATE");
    expect(estimateDefaultProbabilityBand(49).band).toBe("MODERATE");
    expect(estimateDefaultProbabilityBand(50).band).toBe("HIGH");
    expect(estimateDefaultProbabilityBand(74).band).toBe("HIGH");
    expect(estimateDefaultProbabilityBand(75).band).toBe("VERY_HIGH");
    expect(estimateDefaultProbabilityBand(100).band).toBe("VERY_HIGH");
  });
});
