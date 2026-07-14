// ============================================================
// lib/financial-statements/ai-mapping.ts
// Gemini-powered ledger grouping with confidence scores.
// ============================================================

import { getGeminiModel } from "@/lib/gemini";
import { flattenScheduleKeys, CORPORATE_BS_STRUCTURE, CORPORATE_PL_STRUCTURE, NON_CORPORATE_BS_STRUCTURE } from "./schedule3-templates";
import type { AIMappingSuggestion, TemplateStructure } from "./types";

interface AccountInput {
  accountId: string;
  code: string;
  name: string;
  accountType: string;
  currentBalance: number;
}

// ── Build a compact schedule key list for the prompt ──────────
function buildKeyList(structure: TemplateStructure): string {
  const map = flattenScheduleKeys(structure);
  return Array.from(map.entries())
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

// ── Ask Gemini to map accounts → schedule keys ────────────────
export async function generateAIMappings(
  accounts: AccountInput[],
  templateCategory: "CORPORATE" | "NON_CORPORATE",
  statementType: "BALANCE_SHEET" | "PROFIT_LOSS"
): Promise<AIMappingSuggestion[]> {
  const structure =
    templateCategory === "CORPORATE"
      ? statementType === "BALANCE_SHEET"
        ? CORPORATE_BS_STRUCTURE
        : CORPORATE_PL_STRUCTURE
      : NON_CORPORATE_BS_STRUCTURE;

  const keyList = buildKeyList(structure);

  const accountList = accounts
    .map((a) => `${a.code} | ${a.name} | Type: ${a.accountType} | Balance: ${a.currentBalance}`)
    .join("\n");

  const prompt = `You are a Chartered Accountant AI mapping Indian GL accounts to Schedule III line items.

AVAILABLE SCHEDULE III LINE ITEM KEYS:
${keyList}

GL ACCOUNTS TO MAP (Code | Name | Type | Balance):
${accountList}

For each GL account, suggest the BEST matching Schedule III key.
Return ONLY valid JSON array (no markdown, no explanation):
[
  {
    "accountId": "<accountId>",
    "accountCode": "<code>",
    "accountName": "<name>",
    "accountType": "<type>",
    "suggestedKey": "<scheduleKey>",
    "suggestedName": "<scheduleName>",
    "confidence": 0.95,
    "rationale": "one sentence"
  }
]

Rules:
- confidence: 0.0-1.0 (be honest — uncertain = low score)
- If no good match, use suggestedKey = "UNMAPPED" and confidence = 0
- Asset accounts → balance sheet assets keys
- Liability/Equity → balance sheet equity+liabilities keys
- Income → P&L revenue keys
- Expense → P&L expense keys`;

  const model = getGeminiModel();
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Extract JSON from response (Gemini sometimes wraps in markdown)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("AI response did not contain valid JSON array");

  const suggestions: AIMappingSuggestion[] = JSON.parse(jsonMatch[0]);
  return suggestions;
}

// ── Generate AI accounting policies ───────────────────────────
export async function generateAccountingPolicies(
  businessType: string,
  industry: string,
  accountNames: string[]
): Promise<Array<{ policyKey: string; title: string; content: string }>> {
  const prompt = `You are a CA drafting standard accounting policies for an Indian ${businessType} in the ${industry} industry.

Based on these GL account names: ${accountNames.slice(0, 20).join(", ")}

Generate 6-8 significant accounting policies as JSON:
[
  {
    "policyKey": "revenue_recognition",
    "title": "Revenue Recognition",
    "content": "Revenue is recognised when..."
  }
]

Include policies for: revenue recognition, inventory valuation, depreciation, provisions, foreign currency, investments.
Make policies specific to the business type. Return ONLY valid JSON array.`;

  const model = getGeminiModel();
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  return JSON.parse(jsonMatch[0]);
}

// ── Generate AI Notes to Accounts ─────────────────────────────
export async function generateNoteContent(
  noteTitle: string,
  scheduleKey: string,
  accountsInGroup: Array<{ name: string; balance: number }>,
  comparativeAccounts?: Array<{ name: string; balance: number }>
): Promise<{ content: object }> {
  const currentTotal = accountsInGroup.reduce((s, a) => s + a.balance, 0);
  const breakdownLines = accountsInGroup.map((a) => `${a.name}: ₹${a.balance.toFixed(2)}`).join("\n");

  const prompt = `Generate a Schedule III Note to Accounts for "${noteTitle}" (key: ${scheduleKey}).

Current year accounts:
${breakdownLines}
Total: ₹${currentTotal.toFixed(2)}

Return structured JSON for the note content:
{
  "items": [
    { "label": "Account Name", "currentAmount": 0, "comparativeAmount": 0 }
  ],
  "total": { "currentAmount": 0, "comparativeAmount": 0 }
}

Return ONLY valid JSON.`;

  const model = getGeminiModel();
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      content: {
        items: accountsInGroup.map((a) => ({
          label: a.name,
          currentAmount: a.balance,
          comparativeAmount: comparativeAccounts?.find((c) => c.name === a.name)?.balance ?? 0,
        })),
        total: {
          currentAmount: currentTotal,
          comparativeAmount: comparativeAccounts?.reduce((s, a) => s + a.balance, 0) ?? 0,
        },
      },
    };
  }
  return { content: JSON.parse(jsonMatch[0]) };
}

// ── AI Report Review ──────────────────────────────────────────
export async function generateAIReview(params: {
  reportData: object;
  businessName: string;
  industry: string;
  period: string;
}): Promise<string> {
  const model = getGeminiModel();
  const prompt = `You are a CA reviewing financial statements for ${params.businessName} (${params.industry}) for period ${params.period}.

Statement data summary: ${JSON.stringify(params.reportData).slice(0, 2000)}

Provide a professional financial review covering:
1. Balance Sheet health (liquidity, leverage, net worth)
2. P&L performance (revenue trends, margin analysis)
3. Key ratios (current ratio, debt-equity, ROE)
4. Red flags or anomalies
5. Recommendations

Format as structured markdown. Be data-specific and professional.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}
