// ============================================================
// lib/lending/ai/explain.ts
//
// AI assistance for the Lending Platform — explain a rejection,
// narrate a risk score, and draft an underwriting summary.
// STRICTLY ADVISORY: never changes a decision, never auto-approves.
// Mirrors lib/tax/ai/explain.ts's shape exactly, including graceful
// degradation to a deterministic explanation when GEMINI_API_KEY is
// not configured, so lending flows never depend on the AI being up.
// ============================================================

import { getGeminiModel } from "@/lib/gemini";
import { estimateDefaultProbabilityBand, type RiskScoreFactor } from "../core/risk";
import type { EligibilityCheckResult } from "../core/eligibility";

function aiAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

async function ask(prompt: string): Promise<string> {
  const model = getGeminiModel();
  const result = await model.generateContent([
    {
      text:
        "You are FinRP's lending underwriting assistant. Be concise, factual, and practical. " +
        "Never state or imply that you are approving, rejecting, or overriding a credit decision — " +
        "you only explain decisions and data that were already produced by the platform's rules engine.",
    },
    { text: prompt },
  ]);
  return result.response.text().trim();
}

// ---------------------------------------------------------------------------
// Explain why a loan application was rejected
// ---------------------------------------------------------------------------

export interface ExplainRejectionInput {
  applicationNumber: string;
  productName: string;
  requestedAmount: number;
  rejectionReason?: string | null;
  failedChecks: EligibilityCheckResult[];
  riskScore?: number | null;
  riskCategory?: string | null;
}

export async function explainRejection(input: ExplainRejectionInput): Promise<string> {
  if (!aiAvailable()) return deterministicRejectionExplanation(input);
  try {
    const checks = input.failedChecks.map((c) => `- ${c.ruleName}: ${c.message}`).join("\n") || "none recorded";
    const prompt = `Explain in plain language why loan application ${input.applicationNumber} (${input.productName}, ₹${input.requestedAmount}) was rejected, for the applicant to understand.
Rejection reason on file: ${input.rejectionReason ?? "not specified"}
Failed eligibility checks:
${checks}
Risk score: ${input.riskScore ?? "not computed"} (${input.riskCategory ?? "—"})
Keep it to 3-4 sentences, empathetic but factual. Do not suggest ways to circumvent the checks.`;
    return await ask(prompt);
  } catch {
    return deterministicRejectionExplanation(input);
  }
}

function deterministicRejectionExplanation(input: ExplainRejectionInput): string {
  const failed = input.failedChecks.filter((c) => !c.passed);
  if (failed.length === 0) {
    return `Application ${input.applicationNumber} was rejected${input.rejectionReason ? `: ${input.rejectionReason}` : "."} No specific eligibility rule failures were on record — see the approval history for the reviewer's decision detail.`;
  }
  const reasons = failed.map((c) => `${c.ruleName.replace(/_/g, " ")} (expected ${c.expectedValue ?? "—"}, actual ${c.actualValue ?? "—"})`);
  return `Application ${input.applicationNumber} for ₹${input.requestedAmount} was rejected. The following eligibility criteria were not met: ${reasons.join("; ")}.${input.rejectionReason ? ` Reviewer note: ${input.rejectionReason}` : ""}`;
}

// ---------------------------------------------------------------------------
// Narrate a risk score / default-probability band in plain language
// ---------------------------------------------------------------------------

export async function narrateDefaultRisk(riskScore: number, factors: RiskScoreFactor[]): Promise<string> {
  const band = estimateDefaultProbabilityBand(riskScore);
  if (!aiAvailable()) return deterministicRiskNarration(riskScore, band.label, factors);
  try {
    const factorList = factors.map((f) => `${f.factor.replace(/_/g, " ")}: ${f.contribution.toFixed(1)} pts (weight ${(f.weight * 100).toFixed(0)}%)`).join("\n");
    const prompt = `A loan applicant has a risk score of ${riskScore}/100 (${band.label} risk, approximate default likelihood ${band.approxRange} — this is a heuristic band, not a calibrated probability). Contributing factors:
${factorList}
Write a 2-3 sentence underwriter-facing summary of what's driving this score.`;
    return await ask(prompt);
  } catch {
    return deterministicRiskNarration(riskScore, band.label, factors);
  }
}

function deterministicRiskNarration(riskScore: number, bandLabel: string, factors: RiskScoreFactor[]): string {
  const top = [...factors].sort((a, b) => b.contribution - a.contribution)[0];
  return `Risk score ${riskScore}/100 (${bandLabel}).${top ? ` The largest contributor is ${top.factor.replace(/_/g, " ")} (${top.contribution.toFixed(1)} points).` : ""}`;
}

// ---------------------------------------------------------------------------
// Underwriting summary — drafts the reasoning an underwriter can review/edit
// before recording a decision (see lib/lending/underwriting.ts)
// ---------------------------------------------------------------------------

export interface UnderwritingSummaryInput {
  applicationNumber: string;
  productName: string;
  requestedAmount: number;
  requestedTenureMonths: number;
  riskScore: number;
  riskCategory: string;
  eligibilityChecks: EligibilityCheckResult[];
  collateralValue?: number;
}

export async function generateUnderwritingSummary(input: UnderwritingSummaryInput): Promise<string> {
  if (!aiAvailable()) return deterministicUnderwritingSummary(input);
  try {
    const failed = input.eligibilityChecks.filter((c) => !c.passed).map((c) => c.message);
    const prompt = `Draft a short underwriting summary (3-5 sentences) for a human underwriter reviewing loan application ${input.applicationNumber}.
Product: ${input.productName}, requested ₹${input.requestedAmount} over ${input.requestedTenureMonths} months.
Risk score: ${input.riskScore}/100 (${input.riskCategory}).
${input.collateralValue ? `Collateral offered: ₹${input.collateralValue}.` : "No collateral offered."}
Eligibility concerns: ${failed.length ? failed.join("; ") : "none"}.
State the key facts and risk drivers only — do not recommend approve/reject; that decision is the underwriter's.`;
    return await ask(prompt);
  } catch {
    return deterministicUnderwritingSummary(input);
  }
}

function deterministicUnderwritingSummary(input: UnderwritingSummaryInput): string {
  const failed = input.eligibilityChecks.filter((c) => !c.passed);
  const parts = [
    `Application ${input.applicationNumber}: ₹${input.requestedAmount} requested over ${input.requestedTenureMonths} months for ${input.productName}.`,
    `Risk score ${input.riskScore}/100 (${input.riskCategory}).`,
    input.collateralValue ? `Collateral of ₹${input.collateralValue} offered.` : "No collateral offered.",
    failed.length ? `${failed.length} eligibility check(s) failed: ${failed.map((f) => f.ruleName).join(", ")}.` : "All eligibility checks passed.",
  ];
  return parts.join(" ");
}
