import { describe, it, expect } from "vitest";
import { categorizeScore, computeCreditTrend } from "@/lib/credit/core/risk-categorization";

describe("categorizeScore", () => {
  it("bands the standard 300-900 bureau scale at documented thresholds", () => {
    expect(categorizeScore(900)).toBe("LOW");
    expect(categorizeScore(750)).toBe("LOW");
    expect(categorizeScore(749)).toBe("MEDIUM");
    expect(categorizeScore(700)).toBe("MEDIUM");
    expect(categorizeScore(699)).toBe("HIGH");
    expect(categorizeScore(650)).toBe("HIGH");
    expect(categorizeScore(649)).toBe("CRITICAL");
    expect(categorizeScore(300)).toBe("CRITICAL");
  });
});

describe("computeCreditTrend", () => {
  it("reports INSUFFICIENT_DATA for zero or one data point", () => {
    expect(computeCreditTrend([]).direction).toBe("INSUFFICIENT_DATA");
    const single = computeCreditTrend([{ pulledAt: new Date(), score: 750 }]);
    expect(single.direction).toBe("INSUFFICIENT_DATA");
    expect(single.latestScore).toBe(750);
    expect(single.previousScore).toBeNull();
  });

  it("detects IMPROVING when the score rises by more than the noise threshold", () => {
    const trend = computeCreditTrend([
      { pulledAt: new Date("2026-01-01"), score: 700 },
      { pulledAt: new Date("2026-04-01"), score: 740 },
    ]);
    expect(trend.direction).toBe("IMPROVING");
    expect(trend.delta).toBe(40);
  });

  it("detects DECLINING when the score falls", () => {
    const trend = computeCreditTrend([
      { pulledAt: new Date("2026-01-01"), score: 740 },
      { pulledAt: new Date("2026-04-01"), score: 700 },
    ]);
    expect(trend.direction).toBe("DECLINING");
    expect(trend.delta).toBe(-40);
  });

  it("treats small moves (within +/-10) as STABLE rather than noise-driven direction changes", () => {
    const trend = computeCreditTrend([
      { pulledAt: new Date("2026-01-01"), score: 720 },
      { pulledAt: new Date("2026-04-01"), score: 725 },
    ]);
    expect(trend.direction).toBe("STABLE");
  });

  it("only compares the two most recent points when more than two are given", () => {
    const trend = computeCreditTrend([
      { pulledAt: new Date("2026-01-01"), score: 600 },
      { pulledAt: new Date("2026-03-01"), score: 900 },
      { pulledAt: new Date("2026-06-01"), score: 750 },
    ]);
    expect(trend.previousScore).toBe(900);
    expect(trend.latestScore).toBe(750);
    expect(trend.direction).toBe("DECLINING");
  });
});
