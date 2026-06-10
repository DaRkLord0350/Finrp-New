// ============================================================
// FinRP Banking OS — Bank Statement Parser
// Parses CSV, Excel, and text-PDF bank statements.
// Auto-detects column mapping; supports major Indian banks.
// ============================================================

import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ParsedBankTransaction, StatementParseResult } from "../types";

// ---------------------------------------------------------------------------
// Known bank column templates
// ---------------------------------------------------------------------------
const BANK_TEMPLATES: Record<string, {
  dateCol: string[];
  narrationCol: string[];
  creditCol: string[];
  debitCol: string[];
  balanceCol: string[];
  refCol: string[];
  dateFormat?: string;
}> = {
  HDFC: {
    dateCol: ["date", "txn date", "transaction date", "value date"],
    narrationCol: ["narration", "description", "particulars", "transaction details"],
    creditCol: ["credit", "credit amount", "deposit"],
    debitCol: ["debit", "debit amount", "withdrawal"],
    balanceCol: ["balance", "closing balance"],
    refCol: ["cheque no", "chq./ref.no.", "reference number"],
  },
  SBI: {
    dateCol: ["txn date", "transaction date", "date"],
    narrationCol: ["description", "narration", "transaction remarks"],
    creditCol: ["credit", "cr"],
    debitCol: ["debit", "dr"],
    balanceCol: ["balance"],
    refCol: ["ref no./ cheque no"],
  },
  ICICI: {
    dateCol: ["transaction date", "value date", "date"],
    narrationCol: ["transaction remarks", "narration", "description"],
    creditCol: ["credit amount", "cr"],
    debitCol: ["debit amount", "dr"],
    balanceCol: ["balance"],
    refCol: ["cheque number"],
  },
  AXIS: {
    dateCol: ["tran date", "tran. date", "transaction date"],
    narrationCol: ["particulars", "narration", "description"],
    creditCol: ["credit", "cr amount"],
    debitCol: ["debit", "dr amount"],
    balanceCol: ["balance"],
    refCol: ["ref/cheque no"],
  },
  KOTAK: {
    dateCol: ["value date", "transaction date"],
    narrationCol: ["description", "narration"],
    creditCol: ["deposit amount (cr)", "credit"],
    debitCol: ["withdrawal amount (dr)", "debit"],
    balanceCol: ["balance (in rs.)"],
    refCol: ["chq. no.", "reference"],
  },
};

// ---------------------------------------------------------------------------
// Parse CSV
// ---------------------------------------------------------------------------
export function parseCSV(
  content: string,
  columnMapping?: Record<string, string>
): StatementParseResult {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    return { transactions: [], totalRows: 0, errorRows: 0, duplicateRows: 0, errors: result.errors.map(e => ({ row: e.row ?? 0, message: e.message })) };
  }

  const headers = result.meta.fields ?? [];
  const mapping = columnMapping ?? detectColumnMapping(headers);
  const detectedBank = detectBank(headers);

  return rowsToTransactions(result.data, mapping, detectedBank);
}

// ---------------------------------------------------------------------------
// Parse Excel (.xlsx / .xls)
// ---------------------------------------------------------------------------
export function parseExcel(
  buffer: Buffer,
  columnMapping?: Record<string, string>
): StatementParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    header: 0,
    defval: "",
    raw: false,
    dateNF: "YYYY-MM-DD",
  });

  if (rows.length === 0) {
    return { transactions: [], totalRows: 0, errorRows: 0, duplicateRows: 0, errors: [] };
  }

  const headers = Object.keys(rows[0]).map(h => String(h).trim().toLowerCase());
  const normalizedRows = rows.map(r =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toLowerCase(), String(v ?? "").trim()]))
  );

  const mapping = columnMapping ?? detectColumnMapping(headers);
  const detectedBank = detectBank(headers);

  return rowsToTransactions(normalizedRows, mapping, detectedBank);
}

// ---------------------------------------------------------------------------
// Parse PDF (text extraction — works for text-based PDFs)
// ---------------------------------------------------------------------------
export async function parsePDF(
  buffer: Buffer,
  columnMapping?: Record<string, string>
): Promise<StatementParseResult> {
  // Attempt to parse as CSV first (some banks export text PDFs that can be parsed directly)
  // For real PDF parsing, use a server-side PDF text extraction library.
  // Here we convert buffer to string and try to detect tabular data.
  try {
    const textContent = buffer.toString("utf-8");
    const lines = textContent.split("\n").map(l => l.trim()).filter(Boolean);

    // Find header line
    const headerIdx = lines.findIndex(l =>
      /date|narration|debit|credit|balance/i.test(l)
    );
    if (headerIdx === -1) {
      return { transactions: [], totalRows: 0, errorRows: 0, duplicateRows: 0, errors: [{ row: 0, message: "Could not find table header in PDF" }] };
    }

    const csvContent = lines.slice(headerIdx).join("\n");
    return parseCSV(csvContent, columnMapping);
  } catch (err) {
    return {
      transactions: [],
      totalRows: 0,
      errorRows: 1,
      duplicateRows: 0,
      errors: [{ row: 0, message: `PDF parse error: ${(err as Error).message}` }],
    };
  }
}

// ---------------------------------------------------------------------------
// Detect column mapping from headers
// ---------------------------------------------------------------------------
export function detectColumnMapping(headers: string[]): Record<string, string> {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());

  function findCol(candidates: string[]): string | undefined {
    for (const cand of candidates) {
      const match = lowerHeaders.find(h => h.includes(cand) || cand.includes(h));
      if (match) return headers[lowerHeaders.indexOf(match)];
    }
    return undefined;
  }

  // Try each bank template first
  for (const template of Object.values(BANK_TEMPLATES)) {
    const dateCol = findCol(template.dateCol);
    const narrationCol = findCol(template.narrationCol);
    const creditCol = findCol(template.creditCol);
    const debitCol = findCol(template.debitCol);

    if (dateCol && narrationCol && (creditCol || debitCol)) {
      return {
        date: dateCol,
        narration: narrationCol,
        credit: creditCol ?? "",
        debit: debitCol ?? "",
        balance: findCol(template.balanceCol) ?? "",
        reference: findCol(template.refCol) ?? "",
      };
    }
  }

  // Generic fallback
  const genericDateCandidates = ["date", "txn date", "transaction date", "value date", "posting date"];
  const genericNarrationCandidates = ["narration", "description", "particulars", "details", "remarks", "transaction details"];
  const genericCreditCandidates = ["credit", "cr", "deposit", "income", "in", "received"];
  const genericDebitCandidates = ["debit", "dr", "withdrawal", "payment", "expense", "out", "paid"];
  const genericBalanceCandidates = ["balance", "closing balance", "running balance"];
  const genericRefCandidates = ["reference", "ref", "cheque", "chq", "utr", "transaction id"];

  return {
    date: findCol(genericDateCandidates) ?? "",
    narration: findCol(genericNarrationCandidates) ?? "",
    credit: findCol(genericCreditCandidates) ?? "",
    debit: findCol(genericDebitCandidates) ?? "",
    balance: findCol(genericBalanceCandidates) ?? "",
    reference: findCol(genericRefCandidates) ?? "",
  };
}

// ---------------------------------------------------------------------------
// Detect bank from header patterns
// ---------------------------------------------------------------------------
export function detectBank(headers: string[]): string | undefined {
  const headerStr = headers.join(" ").toLowerCase();

  if (/hdfc/i.test(headerStr) || /chq\.\/ref\.no/i.test(headerStr)) return "HDFC";
  if (/sbi|state bank/i.test(headerStr)) return "SBI";
  if (/icici/i.test(headerStr)) return "ICICI";
  if (/axis/i.test(headerStr) || /tran date/i.test(headerStr)) return "AXIS";
  if (/kotak/i.test(headerStr)) return "KOTAK";
  if (/pnb|punjab national/i.test(headerStr)) return "PNB";
  if (/yes bank/i.test(headerStr)) return "YES_BANK";
  return undefined;
}

// ---------------------------------------------------------------------------
// Convert rows to ParsedBankTransaction array
// ---------------------------------------------------------------------------
function rowsToTransactions(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
  detectedBank?: string
): StatementParseResult {
  const transactions: ParsedBankTransaction[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  let errorRows = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-based + header

    const dateRaw = mapping.date ? row[mapping.date] : undefined;
    const narration = mapping.narration ? (row[mapping.narration] ?? "").trim() : "";

    if (!dateRaw || !narration) {
      errorRows++;
      if (dateRaw !== undefined || narration !== undefined) {
        errors.push({ row: rowNum, message: "Missing date or narration" });
      }
      continue;
    }

    const txnDate = parseDate(dateRaw);
    if (!txnDate) {
      errorRows++;
      errors.push({ row: rowNum, message: `Invalid date: "${dateRaw}"` });
      continue;
    }

    const creditRaw = mapping.credit ? row[mapping.credit] : undefined;
    const debitRaw = mapping.debit ? row[mapping.debit] : undefined;
    const balanceRaw = mapping.balance ? row[mapping.balance] : undefined;
    const refRaw = mapping.reference ? row[mapping.reference] : undefined;

    const credit = parseAmount(creditRaw);
    const debit = parseAmount(debitRaw);
    const balance = parseAmount(balanceRaw);

    if (credit === undefined && debit === undefined) {
      // Try to detect a combined amount column with Dr/Cr suffix
      const allValues = Object.entries(row);
      const amtEntry = allValues.find(([, v]) => /[\d,]+\.?\d*/.test(v) && !/(date|narration|desc|remark)/i.test(""));
      if (!amtEntry) {
        errorRows++;
        errors.push({ row: rowNum, message: "Could not parse credit/debit amount" });
        continue;
      }
    }

    transactions.push({
      transactionDate: txnDate,
      narration,
      credit: credit ?? undefined,
      debit: debit ?? undefined,
      balance: balance ?? undefined,
      referenceNumber: refRaw?.trim() || undefined,
    });
  }

  return {
    transactions,
    totalRows: rows.length,
    errorRows,
    duplicateRows: 0,
    detectedBank,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Date parser — handles common Indian bank date formats
// ---------------------------------------------------------------------------
function parseDate(raw: string): Date | null {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;

  // ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s);

  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const m1 = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (m1) return new Date(`${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`);

  // DD/MM/YY
  const m2 = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (m2) {
    const year = parseInt(m2[3]) > 50 ? `19${m2[3]}` : `20${m2[3]}`;
    return new Date(`${year}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`);
  }

  // Month name formats: "01 Jan 2024", "Jan 01, 2024"
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Amount parser — handles Indian number formatting (commas, parens for negative)
// ---------------------------------------------------------------------------
function parseAmount(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  if (!s || s === "-" || s === "" || s.toLowerCase() === "nil") return undefined;

  const negative = s.startsWith("(") && s.endsWith(")");
  const cleaned = s.replace(/[(),₹$\s]/g, "").replace(/,/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num) || num === 0) return undefined;
  return negative ? -num : num;
}
