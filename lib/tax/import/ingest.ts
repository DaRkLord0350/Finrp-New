// ============================================================
// lib/tax/import/ingest.ts
//
// Persists a parsed source into a TaxImportBatch + one TaxImportRecord
// per row, preserving BOTH the untouched raw row and the normalized
// projection for audit. The destination engine (e.g. lib/tax/gst) then
// reads the NORMALIZED + VALID records and commits them into its own
// tables, updating each record's status + targetId.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { Prisma, TaxImportSource, TaxScheme } from "@prisma/client";
import type { RawRow, RowNormalizer } from "./types";

export interface IngestArgs<T> {
  organizationId: string;
  scheme: TaxScheme;
  /** Logical destination, e.g. "GST_INVOICES" | "GSTR2B". */
  module: string;
  source: TaxImportSource;
  period?: string;
  fileName?: string;
  fileKey?: string;
  createdById?: string;
  rows: RawRow[];
  /** Full raw source kept on the batch for audit (small files only). */
  rawPayload?: Prisma.InputJsonValue;
  meta?: Prisma.InputJsonValue;
  /** Module-specific projection of each raw row. */
  normalize?: RowNormalizer<T>;
}

export interface IngestResult {
  batchId: string;
  rowCount: number;
  validCount: number;
  errorCount: number;
}

/**
 * Ingest parsed rows into a new import batch. Returns the batch id and
 * row tallies. Records start as VALID (normalized OK) or INVALID (had
 * normalization errors); committing to the destination table is a
 * separate step the owning module performs.
 */
export async function ingestImportBatch<T>(args: IngestArgs<T>): Promise<IngestResult> {
  const { rows, normalize } = args;

  const recordsData = rows.map((raw, index) => {
    let normalized: T | undefined;
    let errors: { field?: string; message: string }[] | undefined;
    let skip = false;

    if (normalize) {
      const res = normalize(raw, index);
      normalized = res.normalized;
      errors = res.errors;
      skip = res.skip ?? false;
    }

    const status = skip ? "SKIPPED" : errors && errors.length > 0 ? "INVALID" : "VALID";

    return {
      rowIndex: index,
      raw: raw as Prisma.InputJsonValue,
      normalized: (normalized ?? undefined) as Prisma.InputJsonValue | undefined,
      status: status as "VALID" | "INVALID" | "SKIPPED",
      errors: (errors && errors.length > 0 ? errors : undefined) as Prisma.InputJsonValue | undefined,
    };
  });

  const validCount = recordsData.filter((r) => r.status === "VALID").length;
  const errorCount = recordsData.filter((r) => r.status === "INVALID").length;

  const batch = await prisma.taxImportBatch.create({
    data: {
      organizationId: args.organizationId,
      scheme: args.scheme,
      module: args.module,
      source: args.source,
      period: args.period,
      fileName: args.fileName,
      fileKey: args.fileKey,
      createdById: args.createdById,
      status: "NORMALIZED",
      rowCount: rows.length,
      validCount,
      errorCount,
      rawPayload: args.rawPayload,
      meta: args.meta,
      records: {
        create: recordsData.map((r) => ({
          organizationId: args.organizationId,
          rowIndex: r.rowIndex,
          raw: r.raw,
          normalized: r.normalized,
          status: r.status,
          errors: r.errors,
        })),
      },
    },
  });

  return { batchId: batch.id, rowCount: rows.length, validCount, errorCount };
}

/** Mark a record committed into a destination row (idempotency support). */
export async function markRecordCommitted(recordId: string, targetType: string, targetId: string) {
  await prisma.taxImportRecord.update({
    where: { id: recordId },
    data: { status: "COMMITTED", targetType, targetId },
  });
}

/** Bump the batch's committed tally + final status. */
export async function finalizeBatch(batchId: string, committedCount: number) {
  await prisma.taxImportBatch.update({
    where: { id: batchId },
    data: { committedCount, status: "COMMITTED" },
  });
}
