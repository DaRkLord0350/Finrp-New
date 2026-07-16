// ============================================================
// lib/verification/ai/summarize.ts
// "Summarize verification case" — STRICTLY ADVISORY, never recommends
// completing or rejecting a case (that's the reviewer's decision).
// Mirrors lib/aml/ai/summarize.ts's graceful-degrade contract.
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
        "You are FinRP's background-verification assistant. Be concise and factual. Never recommend completing " +
        "or rejecting a verification case — that is the reviewer's decision. You only summarize the checks that " +
        "were already run.",
    },
    { text: prompt },
  ]);
  return result.response.text().trim();
}

export interface VerificationCaseSummaryInput {
  caseNumber: string;
  subjectName: string;
  checks: { checkType: string; status: string; failureReason?: string | null }[];
}

export async function summarizeVerificationCase(input: VerificationCaseSummaryInput): Promise<string> {
  if (!aiAvailable()) return deterministicSummary(input);
  try {
    const checkList = input.checks
      .map((c) => `- ${c.checkType}: ${c.status}${c.failureReason ? ` (${c.failureReason})` : ""}`)
      .join("\n");
    const prompt = `Summarize verification case ${input.caseNumber} for a reviewer in 3-4 sentences.
Subject: ${input.subjectName}.
Checks performed:
${checkList}
State the facts only — do not recommend completing or rejecting the case.`;
    return await ask(prompt);
  } catch {
    return deterministicSummary(input);
  }
}

function deterministicSummary(input: VerificationCaseSummaryInput): string {
  const byStatus = input.checks.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});
  const statusText = Object.entries(byStatus).map(([status, count]) => `${count} ${status}`).join(", ");
  const failed = input.checks.filter((c) => c.status === "FAILED");
  const failedText = failed.length
    ? ` Failed checks: ${failed.map((c) => `${c.checkType}${c.failureReason ? ` (${c.failureReason})` : ""}`).join(", ")}.`
    : "";
  return `Case ${input.caseNumber} for ${input.subjectName}: ${input.checks.length} check(s) recorded (${statusText || "none"}).${failedText} Review each check's source and result before deciding on case completion.`;
}
