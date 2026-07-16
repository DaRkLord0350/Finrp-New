// ============================================================
// lib/aml/ai/summarize.ts
// "Summarize AML findings" — STRICTLY ADVISORY, never recommends
// clearing or filing a SAR (that's a human compliance decision).
// Mirrors lib/lending/ai/explain.ts and lib/credit/ai/summarize.ts's
// graceful-degrade contract.
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
        "You are FinRP's AML compliance assistant. Be concise and factual. Never recommend clearing a case or " +
        "filing/not filing a Suspicious Activity Report — those are compliance officer decisions. You only " +
        "summarize the screening data that was already produced.",
    },
    { text: prompt },
  ]);
  return result.response.text().trim();
}

export interface AMLCaseSummaryInput {
  caseNumber: string;
  subjectName: string;
  riskRating: string;
  alerts: { alertType: string; severity: string; description: string }[];
}

export async function summarizeAmlCase(input: AMLCaseSummaryInput): Promise<string> {
  if (!aiAvailable()) return deterministicSummary(input);
  try {
    const alertList = input.alerts.map((a) => `- [${a.severity}] ${a.alertType}: ${a.description}`).join("\n");
    const prompt = `Summarize AML case ${input.caseNumber} for a compliance officer in 3-4 sentences.
Subject: ${input.subjectName}. Overall risk rating: ${input.riskRating}.
Alerts:
${alertList}
State the facts only — do not recommend clearing the case or filing a SAR.`;
    return await ask(prompt);
  } catch {
    return deterministicSummary(input);
  }
}

function deterministicSummary(input: AMLCaseSummaryInput): string {
  const bySeverity = input.alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.severity] = (acc[a.severity] ?? 0) + 1;
    return acc;
  }, {});
  const severityText = Object.entries(bySeverity).map(([sev, count]) => `${count} ${sev}`).join(", ");
  return `Case ${input.caseNumber} for ${input.subjectName}: risk rating ${input.riskRating}, ${input.alerts.length} alert(s) (${severityText || "none"}). Review each alert's source and matched entry before deciding on resolution.`;
}
