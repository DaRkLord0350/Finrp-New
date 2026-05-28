// ============================================================
// FinRP — Excel Parser (XLSX / XLS)
// Uses SheetJS (xlsx) for reading Excel files.
// Returns same format as the CSV parser for pipeline compatibility.
// ============================================================

import * as XLSX from "xlsx";
import { readFile } from "fs/promises";
import type { ParsedCSV } from "../csv/parser";

// ---------------------------------------------------------------------------
// Parse Excel file — returns same ParsedCSV interface for pipeline compat
// ---------------------------------------------------------------------------
export async function parseExcelFile(
  filePath: string,
  sheetIndex = 0
): Promise<ParsedCSV> {
  const buffer = await readFile(filePath);
  return parseExcelBuffer(buffer, sheetIndex);
}

export function parseExcelBuffer(
  buffer: Buffer,
  sheetIndex = 0
): ParsedCSV {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,         // parse dates as JS Date objects
    cellNF: false,
    cellText: false,
  });

  const sheetName = workbook.SheetNames[sheetIndex];
  if (!sheetName) {
    throw new Error(`Sheet index ${sheetIndex} not found in workbook`);
  }

  const worksheet = workbook.Sheets[sheetName];

  // Convert to array of arrays to detect headers
  const raw = XLSX.utils.sheet_to_json<(string | number | Date | boolean | null)[]>(
    worksheet,
    { header: 1, defval: null }
  );

  if (raw.length === 0) {
    return { headers: [], rows: [], totalRows: 0, detectedDelimiter: ",", encoding: "utf-8", errors: [] };
  }

  // First non-empty row is the header row
  const headerRow = raw[0];
  const headers = headerRow.map((h) => String(h ?? "").trim()).filter((h) => h !== "");

  // All subsequent rows become objects keyed by header
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < raw.length; i++) {
    const rowArr = raw[i];
    const obj: Record<string, string> = {};
    let hasAnyValue = false;

    for (let j = 0; j < headers.length; j++) {
      const raw = rowArr[j];
      if (raw === null || raw === undefined || raw === "") {
        obj[headers[j]] = "";
      } else if (raw instanceof Date) {
        obj[headers[j]] = raw.toISOString().split("T")[0]; // YYYY-MM-DD
        hasAnyValue = true;
      } else {
        obj[headers[j]] = String(raw).trim();
        if (obj[headers[j]] !== "") hasAnyValue = true;
      }
    }

    if (hasAnyValue) rows.push(obj);
  }

  return {
    headers,
    rows,
    totalRows: rows.length,
    detectedDelimiter: ",",
    encoding: "utf-8",
    errors: [],
  };
}

// ---------------------------------------------------------------------------
// List sheets in a workbook
// ---------------------------------------------------------------------------
export function listSheets(filePath: string): string[] {
  const workbook = XLSX.readFile(filePath, { bookSheets: true });
  return workbook.SheetNames;
}

// ---------------------------------------------------------------------------
// Generate error CSV from import errors for download
// ---------------------------------------------------------------------------
export function generateErrorCSV(
  originalHeaders: string[],
  errorRows: Array<{
    rowIndex: number;
    rawData: Record<string, string>;
    errors: string[];
    warnings: string[];
  }>
): Buffer {
  const headers = ["Row #", ...originalHeaders, "Errors", "Warnings"];

  const data = errorRows.map((row) => {
    const vals: (string | number)[] = [row.rowIndex + 1];
    for (const h of originalHeaders) {
      vals.push(row.rawData[h] ?? "");
    }
    vals.push(row.errors.join("; "));
    vals.push(row.warnings.join("; "));
    return vals;
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Import Errors");

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
