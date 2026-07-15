// ============================================================
// FinRP — MockTbxStatementProvider
//
// Deterministic canned statement lines for development/tests, since
// TBX has provided no sandbox credentials or test environment for
// its Statement API. Mirrors lib/tbx/balance/balance.mock.ts's
// convention (separate implementation, selected by the registry).
//
// Narrations are deliberately chosen to exercise every keyword the
// existing categorization engine (lib/banking/categorization-engine.ts)
// already recognizes — salary, GST, vendor, customer, interest,
// charges — so the categorize → ledger-post pipeline is exercised
// end-to-end in mock mode, not just a single happy path.
// ============================================================

import type { FetchStatementInput, FetchStatementResult, RawStatementLine } from "./statement.types";

interface LineTemplate {
  narration: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  mode: string;
}

const TEMPLATES: LineTemplate[] = [
  { narration: "SALARY CREDIT JUL2026 HRMSPAYROLL", type: "DEBIT", amount: 85_000, mode: "NEFT" },
  { narration: "GST PAYMENT CHALLAN CPIN2607", type: "DEBIT", amount: 42_500, mode: "NEFT" },
  { narration: "NEFT VENDOR PAYMENT SUPPLIER INV 1042", type: "DEBIT", amount: 63_200, mode: "NEFT" },
  { narration: "UPI RECEIPT INVOICE INV-2201 CUSTOMER", type: "CREDIT", amount: 118_000, mode: "UPI" },
  { narration: "INTEREST CR ON SAVINGS ACCOUNT", type: "CREDIT", amount: 1_240, mode: "OTHER" },
  { narration: "BANK CHARGE SERVICE FEE Q3", type: "DEBIT", amount: 590, mode: "OTHER" },
  { narration: "IMPS RECEIPT RCPT CUSTOMER ADVANCE", type: "CREDIT", amount: 25_000, mode: "IMPS" },
  { narration: "TDS PAYMENT CHALLAN 281", type: "DEBIT", amount: 8_400, mode: "NEFT" },
];

function pseudoRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(hash % 10_000) / 10_000;
}

export class MockTbxStatementProvider {
  readonly name = "TBX_STATEMENT_MOCK" as const;

  async fetchStatement(input: FetchStatementInput): Promise<FetchStatementResult> {
    const dayMs = 86_400_000;
    const spanDays = Math.max(1, Math.round((input.toDate.getTime() - input.fromDate.getTime()) / dayMs));
    const lineCount = Math.min(TEMPLATES.length, Math.max(1, Math.ceil(spanDays / 3)));

    let runningBalance = 250_000 + Math.floor(pseudoRandom(input.bankAccountId) * 500_000);
    const lines: RawStatementLine[] = [];

    for (let i = 0; i < lineCount; i++) {
      const template = TEMPLATES[i % TEMPLATES.length];
      const txnDate = new Date(input.fromDate.getTime() + Math.floor((spanDays / lineCount) * i) * dayMs);
      runningBalance += template.type === "CREDIT" ? template.amount : -template.amount;

      lines.push({
        externalTxnId: `mock_${input.bankAccountId}_${txnDate.toISOString().slice(0, 10)}_${i}`,
        transactionDate: txnDate.toISOString(),
        narration: template.narration,
        amount: template.amount,
        type: template.type,
        balanceAfter: runningBalance,
        referenceNumber: `REF${txnDate.getTime().toString().slice(-8)}`,
        utr: template.mode !== "OTHER" ? `UTR${txnDate.getTime().toString().slice(-10)}` : undefined,
        mode: template.mode,
      });
    }

    return {
      outcome: "SUCCESS",
      lines,
      raw: { mock: true, bankAccountId: input.bankAccountId, fromDate: input.fromDate, toDate: input.toDate, lineCount: lines.length },
    };
  }
}
