import { describe, it, expect } from "vitest";
import { computeFraudScore, type FraudSignals } from "@/lib/fraud/core/rules-engine";

const clean: FraudSignals = { duplicatePanCount: 0, duplicateAadhaarCount: 0, velocityCount: 0, blacklistHit: false };

describe("computeFraudScore", () => {
  it("scores a completely clean subject as LOW risk, near zero", () => {
    const result = computeFraudScore(clean);
    expect(result.level).toBe("LOW");
    expect(result.score).toBeLessThan(10);
  });

  it("a blacklist hit alone pushes the score into at least MEDIUM territory", () => {
    const result = computeFraudScore({ ...clean, blacklistHit: true });
    expect(result.score).toBeGreaterThanOrEqual(25);
  });

  it("blacklist hit combined with other signals scores higher than blacklist alone", () => {
    const blacklistOnly = computeFraudScore({ ...clean, blacklistHit: true });
    const blacklistPlusDupes = computeFraudScore({ ...clean, blacklistHit: true, duplicatePanCount: 3, duplicateAadhaarCount: 2, velocityCount: 5 });
    expect(blacklistPlusDupes.score).toBeGreaterThan(blacklistOnly.score);
  });

  it("heavy duplicate PAN activity alone can reach CRITICAL", () => {
    const result = computeFraudScore({ ...clean, duplicatePanCount: 10, duplicateAadhaarCount: 5, velocityCount: 10 });
    expect(result.level).toBe("CRITICAL");
  });

  it("a strong face-match score reduces risk versus a weak one", () => {
    const strongMatch = computeFraudScore({ ...clean, faceMatchScore: 95 });
    const weakMatch = computeFraudScore({ ...clean, faceMatchScore: 20 });
    expect(strongMatch.score).toBeLessThan(weakMatch.score);
  });

  it("failed liveness contributes risk; passed liveness does not", () => {
    const failed = computeFraudScore({ ...clean, livenessPassed: false });
    const passed = computeFraudScore({ ...clean, livenessPassed: true });
    expect(failed.score).toBeGreaterThan(passed.score);
    expect(passed.score).toBe(0);
  });

  it("factor weights always sum to 100% of whatever signals are present", () => {
    const result = computeFraudScore({ ...clean, ipRiskScore: 40, deviceRiskScore: 30 });
    const totalWeight = result.factors.reduce((sum, f) => sum + f.weight, 0);
    expect(totalWeight).toBeCloseTo(1, 2);
  });

  it("clamps the final score into [0, 100] even under extreme inputs", () => {
    const result = computeFraudScore({ duplicatePanCount: 999, duplicateAadhaarCount: 999, velocityCount: 999, blacklistHit: true, ipRiskScore: 100, deviceRiskScore: 100 });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
