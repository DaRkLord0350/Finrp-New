// ============================================================
// lib/tax/ai/explain.ts
//
// AI assistance for the tax engine — explain GST mismatches, summarize
// validation issues, recommend a tax regime, and classify ledgers.
// STRICTLY ADVISORY: these helpers never file a return or mutate data;
// they only return human-readable guidance for the CA to act on.
//
// Degrades gracefully to a deterministic explanation when GEMINI_API_KEY
// is not configured, so flows never depend on the AI being available.
// ============================================================

import { getGeminiModel } from "@/lib/gemini";

function aiAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

async function ask(prompt: string): Promise<string> {
  const model = getGeminiModel();
  const result = await model.generateContent([
    { text: "You are FinRP's Indian tax compliance assistant. Be concise, accurate, and practical. Never instruct the user to file automatically — always defer the filing decision to the CA." },
    { text: prompt },
  ]);
  return result.response.text().trim();
}

export interface MismatchInput {
  invoiceNumber?: string | null;
  supplierGstin?: string | null;
  outcome: string;
  kind?: string | null;
  bookTaxable?: number | null;
  bookTax?: number | null;
  gstr2bTaxable?: number | null;
  gstr2bTax?: number | null;
  difference?: number | null;
}

/** Explain a single GSTR-2B reconciliation mismatch in plain language. */
export async function explainMismatch(m: MismatchInput): Promise<string> {
  if (!aiAvailable()) return deterministicMismatch(m);
  try {
    const prompt = `Explain this GSTR-2B vs books mismatch for a CA and suggest the likely cause + next step:
Invoice: ${m.invoiceNumber ?? "—"} | Supplier GSTIN: ${m.supplierGstin ?? "—"}
Outcome: ${m.outcome} (${m.kind ?? "—"})
Books: taxable ₹${m.bookTaxable ?? 0}, tax ₹${m.bookTax ?? 0}
GSTR-2B: taxable ₹${m.gstr2bTaxable ?? 0}, tax ₹${m.gstr2bTax ?? 0}
Difference: ₹${m.difference ?? 0}
Answer in 2-3 sentences.`;
    return await ask(prompt);
  } catch {
    return deterministicMismatch(m);
  }
}

function deterministicMismatch(m: MismatchInput): string {
  switch (m.outcome) {
    case "MISSING_IN_2B":
      return `Invoice ${m.invoiceNumber ?? ""} is recorded in your books but not yet reflected in GSTR-2B. ITC of ₹${m.bookTax ?? 0} may be deferred until the supplier files their GSTR-1. Follow up with the supplier.`;
    case "MISSING_IN_BOOKS":
      return `Invoice ${m.invoiceNumber ?? ""} appears in GSTR-2B (₹${m.gstr2bTax ?? 0} ITC) but is not in your books. Verify whether this purchase was recorded; if genuine, book it to claim the credit.`;
    case "PARTIAL":
    case "MISMATCH":
      return `Values differ for invoice ${m.invoiceNumber ?? ""} (${m.kind ?? "amount"} mismatch of ₹${m.difference ?? 0}). Re-check the taxable value / tax split against the supplier invoice before claiming ITC.`;
    default:
      return `Invoice ${m.invoiceNumber ?? ""} matched between books and GSTR-2B.`;
  }
}

/** Summarize a list of validation findings into an action list. */
export async function summarizeIssues(
  findings: { ruleCode: string; severity: string; message: string }[]
): Promise<string> {
  if (findings.length === 0) return "No validation issues found.";
  if (!aiAvailable()) {
    const errors = findings.filter((f) => f.severity === "ERROR");
    const warnings = findings.filter((f) => f.severity === "WARNING");
    return `${errors.length} blocking error(s) and ${warnings.length} warning(s). Resolve errors before filing:\n` +
      errors.slice(0, 10).map((e) => `• ${e.message}`).join("\n");
  }
  try {
    const list = findings.slice(0, 40).map((f) => `[${f.severity}] ${f.message}`).join("\n");
    return await ask(`Summarize these GST validation findings into a short, prioritized checklist for a CA:\n${list}`);
  } catch {
    return `${findings.length} issue(s) found. Review the findings list.`;
  }
}

/** Suggest a ledger → tax classification (advisory). */
export async function classifyLedger(name: string, samples: string[] = []): Promise<string> {
  if (!aiAvailable()) {
    return `Unable to auto-classify "${name}" without AI configured. Map it manually to the appropriate GST/expense head.`;
  }
  try {
    return await ask(
      `Suggest the most likely GST treatment and accounting head for a ledger named "${name}". Sample narrations: ${samples.join("; ") || "none"}. Reply with: suggested head, typical GST rate, and whether ITC is usually eligible.`
    );
  } catch {
    return `Could not classify "${name}" right now.`;
  }
}
