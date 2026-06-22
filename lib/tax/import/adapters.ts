// ============================================================
// lib/tax/import/adapters.ts
//
// Source adapters: CSV, Excel, JSON, Tally XML, and manual entry.
// Each returns a flat list of RAW rows + light metadata. Parsing only
// — no normalization or validation happens here.
// ============================================================

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { XMLParser } from "fast-xml-parser";
import type { ParsedSource, RawRow } from "./types";

// ── CSV ───────────────────────────────────────────────────────
export function parseCsv(content: string): ParsedSource {
  const result = Papa.parse<RawRow>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return {
    rows: (result.data ?? []).filter((r) => r && Object.keys(r).length > 0),
    meta: { delimiter: result.meta?.delimiter, parseErrors: result.errors?.length ?? 0 },
  };
}

// ── Excel (.xlsx/.xls) ────────────────────────────────────────
export function parseExcel(buffer: Buffer | ArrayBuffer, sheetName?: string): ParsedSource {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = sheetName ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheet];
  if (!ws) throw new Error(`Sheet "${sheet}" not found in workbook`);
  const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: null, raw: false });
  return { rows, meta: { sheetNames: wb.SheetNames, sheet } };
}

// ── JSON ──────────────────────────────────────────────────────
export function parseJson(content: string | unknown): ParsedSource {
  const data = typeof content === "string" ? JSON.parse(content) : content;
  if (Array.isArray(data)) return { rows: data as RawRow[] };
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    // Common envelope shapes: { rows: [...] } | { data: [...] } | { invoices: [...] }
    for (const key of ["rows", "data", "invoices", "records", "items"]) {
      if (Array.isArray(obj[key])) return { rows: obj[key] as RawRow[], meta: { envelope: key } };
    }
    return { rows: [obj as RawRow] };
  }
  throw new Error("Unsupported JSON shape — expected an array or { rows: [...] }");
}

// ── Tally XML export ──────────────────────────────────────────
// Tally exports vouchers as a nested XML tree. We flatten each
// VOUCHER element into a raw row keyed by its child tags. The exact
// schema varies by Tally version, so the normalizer downstream maps
// the relevant keys; here we only flatten.
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: true,
  trimValues: true,
});

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

export function parseTallyXml(content: string): ParsedSource {
  const doc = xmlParser.parse(content) as Record<string, unknown>;
  // Drill to the collection of vouchers regardless of envelope depth.
  const vouchers: RawRow[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    if (obj.VOUCHER) {
      for (const v of asArray(obj.VOUCHER as RawRow | RawRow[])) vouchers.push(flattenVoucher(v));
    }
    for (const value of Object.values(obj)) {
      if (value && typeof value === "object") walk(value);
    }
  };
  walk(doc);
  return { rows: vouchers, meta: { voucherCount: vouchers.length } };
}

function flattenVoucher(v: RawRow): RawRow {
  const out: RawRow = {};
  for (const [k, val] of Object.entries(v)) {
    if (val === null || typeof val !== "object") {
      out[k] = val;
    } else if (!Array.isArray(val)) {
      // shallow-merge one level of nested ledger entries
      out[k] = JSON.stringify(val);
    } else {
      out[k] = JSON.stringify(val);
    }
  }
  return out;
}

// ── Manual (already-structured rows) ──────────────────────────
export function parseManual(rows: RawRow[]): ParsedSource {
  return { rows, meta: { manual: true } };
}
