// ============================================================
// lib/tax/import/types.ts
//
// Shared contracts for the tax import pipeline. Source adapters turn
// a file/string/object into a flat list of RAW rows; the module-level
// normalizer (passed to ingest) projects each raw row into the shape
// the destination engine expects. Both raw and normalized forms are
// persisted for audit (TaxImportRecord.raw / .normalized).
// ============================================================

export type RawRow = Record<string, unknown>;

export interface ParsedSource {
  rows: RawRow[];
  /** Adapter-level metadata (sheet names, voucher counts, ...). */
  meta?: Record<string, unknown>;
}

export interface RowNormalizeResult<T> {
  normalized?: T;
  errors?: { field?: string; message: string }[];
  skip?: boolean;
}

export type RowNormalizer<T> = (raw: RawRow, index: number) => RowNormalizeResult<T>;
