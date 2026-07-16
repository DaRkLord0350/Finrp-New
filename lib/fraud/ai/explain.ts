// ============================================================
// lib/fraud/ai/explain.ts
// "Summarize fraud indicators" — narrates the rules-engine score
// computed by lib/fraud/core/rules-engine.ts; never generates a score
// itself and never recommends a resolution. Mirrors lib/aml/ai/summarize.ts.
// ============================================================

import { getGeminiModel } from "@/lib/gemini";

function aiAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

async function ask(prompt: string): Promise<string> {
  const model = getGeminiModel();
  const result = await model.generateContent([
    {
      text:
        "You are FinRP's fraud investigation assistant. Be concise and factual. Never recommend clearing a case or " +
        "confirming fraud — those are investigator decisions. You only summarize the signals that were already computed.",
    },
    { text: prompt },
  ]);
  return result.response.text().trim();
}

export interface FraudCaseSummaryInput {
  caseNumber: string;
  subjectName: string;
  riskRating: string;
  alerts: { alertType: string; severity: string; description: string }[];
}

export async function summarizeFraudCase(input: FraudCaseSummaryInput): Promise<string> {
  if (!aiAvailable()) return deterministicSummary(input);
  try {
    const alertList = input.alerts.map((a) => `- [${a.severity}] ${a.alertType}: ${a.description}`).join("\n");
    const prompt = `Summarize fraud case ${input.caseNumber} for an investigator in 3-4 sentences.
Subject: ${input.subjectName}. Overall risk rating: ${input.riskRating}.
Indicators:
${alertList}
State the facts only — do not recommend clearing or confirming fraud.`;
    return await ask(prompt);
  } catch {
    return deterministicSummary(input);
  }
}

function deterministicSummary(input: FraudCaseSummaryInput): string {
  const types = input.alerts.map((a) => a.alertType.replace(/_/g, " ").toLowerCase()).join(", ");
  return `Case ${input.caseNumber} for ${input.subjectName}: risk rating ${input.riskRating}, ${input.alerts.length} indicator(s) — ${types || "none"}. Review each indicator's source before deciding on resolution.`;
}
