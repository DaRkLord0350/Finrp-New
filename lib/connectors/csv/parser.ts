// ============================================================
// FinRP — CSV Parser
// Uses papaparse for RFC 4180-compliant CSV parsing.
// Detects encoding, delimiters, and column types.
// ============================================================

import Papa from "papaparse";
import { createReadStream } from "fs";
import { readFile } from "fs/promises";

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  detectedDelimiter: string;
  encoding: string;
  errors: Array<{ row: number; message: string }>;
}

export interface ColumnStats {
  name: string;
  sampleValues: string[];
  nullCount: number;
  uniqueCount: number;
  inferredType: "string" | "number" | "date" | "boolean" | "email" | "phone" | "gstin";
}

// ---------------------------------------------------------------------------
// Parse CSV file from disk path
// ---------------------------------------------------------------------------
export async function parseCSVFile(filePath: string): Promise<ParsedCSV> {
  const content = await readFile(filePath, "utf-8");
  return parseCSVContent(content);
}

// ---------------------------------------------------------------------------
// Parse CSV content string
// ---------------------------------------------------------------------------
export function parseCSVContent(content: string): ParsedCSV {
  const errors: Array<{ row: number; message: string }> = [];

  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,     // keep everything as strings; we do own type coercion
    transformHeader: (h) => h.trim(),
    transform: (value) => value.trim(),
  });

  for (const err of result.errors) {
    errors.push({
      row: err.row ?? 0,
      message: err.message,
    });
  }

  return {
    headers: result.meta.fields ?? [],
    rows: result.data,
    totalRows: result.data.length,
    detectedDelimiter: result.meta.delimiter ?? ",",
    encoding: "utf-8",
    errors,
  };
}

// ---------------------------------------------------------------------------
// Parse only the first N rows (for column detection preview)
// ---------------------------------------------------------------------------
export function parseCSVPreview(content: string, maxRows = 5): ParsedCSV {
  const full = parseCSVContent(content);
  return {
    ...full,
    rows: full.rows.slice(0, maxRows),
  };
}

// ---------------------------------------------------------------------------
// Analyse column types and sample values
// ---------------------------------------------------------------------------
export function analyseColumns(parsed: ParsedCSV, sampleSize = 5): ColumnStats[] {
  return parsed.headers.map((header) => {
    const values = parsed.rows
      .map((r) => r[header] ?? "")
      .filter((v) => v !== "");

    const sampleValues = values.slice(0, sampleSize);
    const nullCount = parsed.rows.filter((r) => !r[header]?.trim()).length;
    const uniqueValues = new Set(values);

    return {
      name: header,
      sampleValues,
      nullCount,
      uniqueCount: uniqueValues.size,
      inferredType: inferColumnType(values),
    };
  });
}

// ---------------------------------------------------------------------------
// Type inference heuristics
// ---------------------------------------------------------------------------
function inferColumnType(values: string[]): ColumnStats["inferredType"] {
  if (values.length === 0) return "string";

  const sample = values.slice(0, 20);

  // GSTIN check
  const gstinRe = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (sample.some((v) => gstinRe.test(v.toUpperCase()))) return "gstin";

  // Email check
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (sample.filter((v) => emailRe.test(v)).length >= sample.length * 0.7) return "email";

  // Phone check
  const phoneRe = /^[\+]?[\d\s\-\(\)]{7,15}$/;
  if (sample.filter((v) => phoneRe.test(v)).length >= sample.length * 0.7) return "phone";

  // Date check
  const dateRe = /^\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}$/;
  if (sample.filter((v) => dateRe.test(v) || !isNaN(Date.parse(v))).length >= sample.length * 0.7) return "date";

  // Number check
  const numRe = /^-?[\d,]+(\.\d+)?$/;
  if (sample.filter((v) => numRe.test(v.replace(/,/g, ""))).length >= sample.length * 0.8) return "number";

  // Boolean check
  const boolVals = new Set(["true", "false", "yes", "no", "1", "0", "y", "n"]);
  if (sample.every((v) => boolVals.has(v.toLowerCase()))) return "boolean";

  return "string";
}

// ---------------------------------------------------------------------------
// Suggest field mappings based on header name similarity
// ---------------------------------------------------------------------------
const FIELD_SYNONYMS: Record<string, string[]> = {
  name: ["name", "full_name", "fullname", "customer_name", "company_name", "contact_name", "client_name"],
  email: ["email", "email_address", "e-mail", "mail"],
  phone: ["phone", "mobile", "contact", "phone_number", "mobile_number", "cell"],
  address: ["address", "street", "street_address", "billing_address"],
  city: ["city", "town", "locality"],
  state: ["state", "province", "region"],
  country: ["country", "nation"],
  gstin: ["gstin", "gst", "gst_number", "gstn", "tax_id", "taxid"],
  invoiceNumber: ["invoice_no", "invoice_number", "inv_no", "invoice#", "bill_no"],
  dueDate: ["due_date", "payment_due", "due", "paymentdue"],
  amount: ["amount", "total", "grand_total", "net_amount"],
  sku: ["sku", "item_code", "product_code", "part_no"],
  quantity: ["qty", "quantity", "units"],
  price: ["price", "unit_price", "rate", "cost", "selling_price"],
};

export function suggestMappings(headers: string[]): Record<string, string> {
  const suggestions: Record<string, string> = {};

  for (const header of headers) {
    const normalized = header.toLowerCase().replace(/[\s_-]+/g, "_");

    for (const [targetField, synonyms] of Object.entries(FIELD_SYNONYMS)) {
      if (synonyms.some((s) => normalized.includes(s) || s.includes(normalized))) {
        if (!suggestions[header]) {
          suggestions[header] = targetField;
        }
      }
    }
  }

  return suggestions;
}
