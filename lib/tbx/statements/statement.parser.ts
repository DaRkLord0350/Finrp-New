// ============================================================
// FinRP — TBX Statement parser
// Validates and normalizes RawStatementLine[] (whatever shape the
// provider — mock or real, once bound — returns) into a clean
// intermediate form. Initial txnType comes from the payment mode;
// the categorization engine (lib/banking/categorization-engine.ts)
// refines it from narration keywords afterwards — this parser does
// not attempt category inference itself.
// ============================================================

import type { RawStatementLine } from "./statement.types";

export interface ParsedStatementLine {
  externalTxnId: string;
  transactionDate: Date;
  valueDate?: Date;
  narration: string;
  credit?: number;
  debit?: number;
  balanceAfter?: number;
  referenceNumber?: string;
  utr?: string;
  /** Initial guess from payment mode — categorizeTransaction() may override it. */
  txnType: "UPI" | "NEFT" | "RTGS" | "IMPS" | "CHEQUE" | "CASH" | "UNKNOWN";
}

const MODE_TO_TXN_TYPE: Record<string, ParsedStatementLine["txnType"]> = {
  UPI: "UPI",
  NEFT: "NEFT",
  RTGS: "RTGS",
  IMPS: "IMPS",
  CHEQUE: "CHEQUE",
  CASH: "CASH",
};

export interface ParseStatementResult {
  lines: ParsedStatementLine[];
  errors: Array<{ index: number; message: string }>;
}

export function parseStatementLines(rawLines: RawStatementLine[]): ParseStatementResult {
  const lines: ParsedStatementLine[] = [];
  const errors: Array<{ index: number; message: string }> = [];

  rawLines.forEach((raw, index) => {
    if (!raw.externalTxnId) {
      errors.push({ index, message: "Missing externalTxnId" });
      return;
    }
    if (!Number.isFinite(raw.amount) || raw.amount <= 0) {
      errors.push({ index, message: `Invalid amount: ${raw.amount}` });
      return;
    }
    const transactionDate = new Date(raw.transactionDate);
    if (Number.isNaN(transactionDate.getTime())) {
      errors.push({ index, message: `Invalid transactionDate: ${raw.transactionDate}` });
      return;
    }

    lines.push({
      externalTxnId: raw.externalTxnId,
      transactionDate,
      valueDate: raw.valueDate ? new Date(raw.valueDate) : undefined,
      narration: raw.narration || "(no narration)",
      credit: raw.type === "CREDIT" ? raw.amount : undefined,
      debit: raw.type === "DEBIT" ? raw.amount : undefined,
      balanceAfter: raw.balanceAfter,
      referenceNumber: raw.referenceNumber,
      utr: raw.utr,
      txnType: (raw.mode ? MODE_TO_TXN_TYPE[raw.mode] : undefined) ?? "UNKNOWN",
    });
  });

  return { lines, errors };
}
