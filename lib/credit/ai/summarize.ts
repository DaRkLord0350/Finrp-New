// ============================================================
// lib/credit/ai/summarize.ts
// "Summarize credit report" — AI assistance for the Credit Bureau
// module. STRICTLY ADVISORY. Mirrors lib/lending/ai/explain.ts and
// lib/tax/ai/explain.ts: degrades to a deterministic summary when
// GEMINI_API_KEY is not configured, so the pipeline never depends on
// the AI being available.
// ============================================================

import { getGeminiModel } from "@/lib/gemini";
import type { CreditTrendResult } from "../core/risk-categorization";

function aiAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

async function ask(prompt: string): Promise<string> {
  const model = getGeminiModel();
  const result = await model.generateContent([
    {
      text:
        "You are FinRP's credit bureau assistant. Be concise, factual, and practical. " +
        "Never state or imply a lending decision — you only explain bureau data that was already fetched.",
    },
    { text: prompt },
  ]);
  return result.response.text().trim();
}

export interface CreditReportSummaryInput {
  bureau: string;
  score: number | null;
  scoreModel: string | null;
  riskGrade: string | null;
  tradelineCount: number;
  activeTradelineCount: number;
  overdueTradelineCount: number;
  totalOutstanding: number;
  recentEnquiryCount: number;
  trend?: CreditTrendResult;
}

export async function summarizeCreditReport(input: CreditReportSummaryInput): Promise<string> {
  if (!aiAvailable()) return deterministicSummary(input);
  try {
    const prompt = `Summarize this ${input.bureau} credit report for an underwriter in 3-4 sentences.
Score: ${input.score ?? "not available"} (${input.scoreModel ?? "—"}), risk grade ${input.riskGrade ?? "—"}.
Tradelines: ${input.tradelineCount} total, ${input.activeTradelineCount} active, ${input.overdueTradelineCount} overdue.
Total outstanding across tradelines: ₹${input.totalOutstanding}.
Recent enquiries (credit-seeking behavior): ${input.recentEnquiryCount}.
${input.trend && input.trend.direction !== "INSUFFICIENT_DATA" ? `Score trend: ${input.trend.direction} (${input.trend.previousScore} -> ${input.trend.latestScore}).` : ""}
State the key facts only — do not recommend approve/reject.`;
    return await ask(prompt);
  } catch {
    return deterministicSummary(input);
  }
}

function deterministicSummary(input: CreditReportSummaryInput): string {
  const parts = [
    `${input.bureau} score: ${input.score ?? "not available"}${input.riskGrade ? ` (${input.riskGrade} risk)` : ""}.`,
    `${input.tradelineCount} tradeline(s) on file, ${input.activeTradelineCount} active, ${input.overdueTradelineCount} overdue.`,
    `Total outstanding: ₹${input.totalOutstanding.toLocaleString("en-IN")}.`,
    `${input.recentEnquiryCount} recent credit enquiry(ies).`,
  ];
  if (input.trend && input.trend.direction !== "INSUFFICIENT_DATA") {
    parts.push(`Score is ${input.trend.direction.toLowerCase()} since the last pull (${input.trend.previousScore} -> ${input.trend.latestScore}).`);
  }
  return parts.join(" ");
}
