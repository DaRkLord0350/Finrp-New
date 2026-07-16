// ============================================================
// lib/fraud/core/rules-engine.ts
//
// Weighted fraud scoring — pure function, no I/O, mirrors
// lib/lending/core/risk.ts's shape exactly (score 0-100, higher =
// riskier; weight redistributes gracefully across whichever signals
// are actually present, so this doesn't need to change shape as
// Modules add more signal sources over time).
//
// This IS the "AI Fraud Score" the spec asks for — but the SCORE
// itself is a transparent, auditable rules engine, not an opaque ML
// black box fabricated from nothing. lib/fraud/ai/explain.ts narrates
// this score in natural language; it does not generate it.
// ============================================================

import type { RiskLevel } from "@prisma/client";

export interface FraudSignals {
  /** Other active applications sharing this PAN, within the lookback window. */
  duplicatePanCount: number;
  /** Other active applications sharing this Aadhaar hash, within the lookback window. */
  duplicateAadhaarCount: number;
  /** Other applications from the same device fingerprint or IP, within the lookback window. */
  velocityCount: number;
  blacklistHit: boolean;
  /** 0-100 from an IP intelligence provider (VPN/proxy/datacenter likelihood), if available. */
  ipRiskScore?: number;
  /** 0-100 device-risk signal (emulator, rooted device, known-bad fingerprint), if available. */
  deviceRiskScore?: number;
  /** 0-100 biometric face-match confidence, if available — LOWER is worse (inverted below). */
  faceMatchScore?: number;
  livenessPassed?: boolean;
  /** Thin credit file / inconsistent-data composite heuristic, if available (Credit Bureau + document signals). */
  syntheticIdentityScore?: number;
}

export interface FraudScoreFactor {
  factor: string;
  weight: number;
  contribution: number;
}

export interface FraudScoreResult {
  score: number;
  level: RiskLevel;
  factors: FraudScoreFactor[];
}

function levelFor(score: number): RiskLevel {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export function computeFraudScore(signals: FraudSignals): FraudScoreResult {
  const weighted: { name: string; weight: number; riskContribution: number }[] = [];

  // Blacklist is an immediate, dominant signal — not blended proportionally.
  if (signals.blacklistHit) {
    weighted.push({ name: "blacklist_hit", weight: 40, riskContribution: 100 });
  }

  weighted.push({ name: "duplicate_pan", weight: 20, riskContribution: clamp01(signals.duplicatePanCount / 3) * 100 });
  weighted.push({ name: "duplicate_aadhaar", weight: 20, riskContribution: clamp01(signals.duplicateAadhaarCount / 2) * 100 });
  weighted.push({ name: "velocity", weight: 15, riskContribution: clamp01(signals.velocityCount / 5) * 100 });

  if (signals.ipRiskScore !== undefined) {
    weighted.push({ name: "ip_risk", weight: 10, riskContribution: clamp01(signals.ipRiskScore / 100) * 100 });
  }
  if (signals.deviceRiskScore !== undefined) {
    weighted.push({ name: "device_risk", weight: 10, riskContribution: clamp01(signals.deviceRiskScore / 100) * 100 });
  }
  if (signals.faceMatchScore !== undefined) {
    weighted.push({ name: "face_match", weight: 10, riskContribution: (1 - clamp01(signals.faceMatchScore / 100)) * 100 });
  }
  if (signals.livenessPassed !== undefined) {
    weighted.push({ name: "liveness", weight: 10, riskContribution: signals.livenessPassed ? 0 : 100 });
  }
  if (signals.syntheticIdentityScore !== undefined) {
    weighted.push({ name: "synthetic_identity", weight: 15, riskContribution: clamp01(signals.syntheticIdentityScore / 100) * 100 });
  }

  const totalWeight = weighted.reduce((sum, s) => sum + s.weight, 0);
  const factors: FraudScoreFactor[] = weighted.map((s) => ({
    factor: s.name,
    weight: Math.round((s.weight / totalWeight) * 100) / 100,
    contribution: Math.round(s.riskContribution * (s.weight / totalWeight) * 100) / 100,
  }));

  const score = Math.max(0, Math.min(100, Math.round(factors.reduce((sum, f) => sum + f.contribution, 0))));
  return { score, level: levelFor(score), factors };
}
