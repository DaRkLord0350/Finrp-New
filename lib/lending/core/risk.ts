// ============================================================
// lib/lending/core/risk.ts
//
// Rules-based risk scoring — pure function, no I/O. Score is 0-100
// where HIGHER = RISKIER (mirrors a fraud-score convention, distinct
// from a bureau credit score where higher is better).
//
// Only `eligibilityPassRate` and `requestedToMaxAmountRatio` are
// available from Module 1 alone. `creditScore` / `amlRiskLevel` /
// `fraudScore` are optional inputs Modules 2/3/4 will supply once
// built — the weighting degrades gracefully (redistributes weight
// onto whichever signals ARE present) rather than assuming a fixed
// signal set, so this function does not need to change shape when
// those modules land.
// ============================================================

import type { RiskLevel } from "@prisma/client";

export interface RiskScoreInputs {
  /** Fraction of eligibility rules that passed, 0-1. */
  eligibilityPassRate: number;
  /** requestedAmount / product.maxAmount, 0-1+. */
  requestedToMaxAmountRatio: number;
  /** Bureau credit score, e.g. CIBIL 300-900 (Module 2). Higher is better. */
  creditScore?: number;
  amlRiskLevel?: "LOW" | "MEDIUM" | "HIGH"; // Module 3
  /** 0-100, higher = more suspicious (Module 4). */
  fraudScore?: number;
  /** Collateral value / requested amount, when the product requires collateral. */
  collateralCoverageRatio?: number;
}

export interface RiskScoreFactor {
  factor: string;
  weight: number;
  contribution: number; // 0-100, this factor's contribution to the final score
}

export interface RiskScoreResult {
  score: number;
  level: RiskLevel;
  factors: RiskScoreFactor[];
}

function levelFor(score: number): RiskLevel {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

export function computeRiskScore(inputs: RiskScoreInputs): RiskScoreResult {
  const signals: { name: string; weight: number; riskContribution: number }[] = [];

  signals.push({
    name: "eligibility_pass_rate",
    weight: 30,
    riskContribution: (1 - clamp01(inputs.eligibilityPassRate)) * 100,
  });
  signals.push({
    name: "requested_to_max_amount_ratio",
    weight: 15,
    riskContribution: clamp01(inputs.requestedToMaxAmountRatio) * 100,
  });

  if (inputs.creditScore !== undefined) {
    // Normalize a 300-900 bureau score to a 0-100 risk contribution (900 -> 0 risk, 300 -> 100 risk).
    const normalized = clamp01((900 - inputs.creditScore) / (900 - 300));
    signals.push({ name: "credit_score", weight: 30, riskContribution: normalized * 100 });
  }

  if (inputs.amlRiskLevel !== undefined) {
    const map: Record<string, number> = { LOW: 0, MEDIUM: 50, HIGH: 100 };
    signals.push({ name: "aml_risk_level", weight: 15, riskContribution: map[inputs.amlRiskLevel] });
  }

  if (inputs.fraudScore !== undefined) {
    signals.push({ name: "fraud_score", weight: 20, riskContribution: clamp01(inputs.fraudScore / 100) * 100 });
  }

  if (inputs.collateralCoverageRatio !== undefined) {
    // Full (1.0+) coverage -> 0 risk contribution; no collateral -> 100.
    const normalized = 1 - clamp01(inputs.collateralCoverageRatio);
    signals.push({ name: "collateral_coverage", weight: 10, riskContribution: normalized * 100 });
  }

  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const factors: RiskScoreFactor[] = signals.map((s) => ({
    factor: s.name,
    weight: Math.round((s.weight / totalWeight) * 100) / 100,
    contribution: Math.round(s.riskContribution * (s.weight / totalWeight) * 100) / 100,
  }));

  const score = Math.max(0, Math.min(100, Math.round(factors.reduce((sum, f) => sum + f.contribution, 0))));
  return { score, level: levelFor(score), factors };
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 1; // missing/invalid data is treated as maximally risky, never silently ignored
  return Math.max(0, Math.min(1, v));
}

export interface DefaultProbabilityBand {
  band: "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
  label: string;
  approxRange: string;
}

/**
 * Bands the risk score into an approximate default-probability range.
 * Deliberately NOT a single fabricated percentage — this codebase has no
 * calibrated PD model (that requires historical default data this system
 * doesn't have yet), so presenting a precise number would be false
 * precision. A banded heuristic estimate is honest about what it is.
 */
export function estimateDefaultProbabilityBand(riskScore: number): DefaultProbabilityBand {
  if (riskScore >= 75) return { band: "VERY_HIGH", label: "Very High", approxRange: ">35%" };
  if (riskScore >= 50) return { band: "HIGH", label: "High", approxRange: "15-35%" };
  if (riskScore >= 25) return { band: "MODERATE", label: "Moderate", approxRange: "5-15%" };
  return { band: "LOW", label: "Low", approxRange: "<5%" };
}
