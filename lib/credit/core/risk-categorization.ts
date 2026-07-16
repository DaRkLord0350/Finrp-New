// ============================================================
// lib/credit/core/risk-categorization.ts
// Pure function: bureau score -> RiskLevel band. Pull-based (not
// AI-based) so it's deterministic and auditable — the same input
// score always yields the same band, which downstream underwriting
// and monitoring rely on.
//
// Bands follow the standard 300-900 Indian bureau scale (CIBIL/
// Experian/CRIF/Equifax all report on this range) — see RBI/credit
// industry convention: 750+ prime, 700-749 near-prime, 650-699
// subprime, <650 high-risk / thin file.
// ============================================================

import type { RiskLevel } from "@prisma/client";

export function categorizeScore(score: number): RiskLevel {
  if (score >= 750) return "LOW";
  if (score >= 700) return "MEDIUM";
  if (score >= 650) return "HIGH";
  return "CRITICAL";
}

export interface CreditTrendPoint {
  pulledAt: Date;
  score: number;
}

export interface CreditTrendResult {
  direction: "IMPROVING" | "DECLINING" | "STABLE" | "INSUFFICIENT_DATA";
  latestScore: number | null;
  previousScore: number | null;
  delta: number | null;
}

/** Points must be ordered oldest-first. */
export function computeCreditTrend(points: CreditTrendPoint[]): CreditTrendResult {
  if (points.length === 0) return { direction: "INSUFFICIENT_DATA", latestScore: null, previousScore: null, delta: null };
  if (points.length === 1) {
    return { direction: "INSUFFICIENT_DATA", latestScore: points[0].score, previousScore: null, delta: null };
  }

  const latest = points[points.length - 1].score;
  const previous = points[points.length - 2].score;
  const delta = latest - previous;

  const direction: CreditTrendResult["direction"] = delta > 10 ? "IMPROVING" : delta < -10 ? "DECLINING" : "STABLE";
  return { direction, latestScore: latest, previousScore: previous, delta };
}
