// ============================================================
// lib/tax/gst/gstr2b.ts
//
// Import GSTR-2B records (from a GSP fetch or an uploaded file) into
// Gstr2bRecord rows for ITC reconciliation.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { Gstr2bRow } from "../filing/provider";
import type { RawRow } from "../import/types";
import { round2 } from "../core/money";

/** Map flexible file rows into the canonical Gstr2bRow shape. */
export function normalize2bRows(rows: RawRow[]): Gstr2bRow[] {
  const pick = (raw: RawRow, keys: string[]): string | undefined => {
    const lower = new Map<string, unknown>();
    for (const [k, v] of Object.entries(raw)) lower.set(k.toLowerCase().replace(/[\s_]+/g, ""), v);
    for (const key of keys) {
      const hit = lower.get(key.toLowerCase().replace(/[\s_]+/g, ""));
      if (hit !== undefined && hit !== null && hit !== "") return String(hit).trim();
    }
    return undefined;
  };
  const num = (v?: string) => {
    if (!v) return 0;
    const x = Number(v.replace(/[, ]/g, ""));
    return Number.isFinite(x) ? x : 0;
  };

  return rows
    .map((r) => ({
      supplierGstin: pick(r, ["supplier_gstin", "gstin", "ctin", "supplier gstin"]),
      supplierName: pick(r, ["supplier_name", "trade name", "supplier", "name"]),
      invoiceNumber: pick(r, ["invoice_number", "invoice no", "inum", "invoiceno"]) ?? "",
      invoiceDate: pick(r, ["invoice_date", "date", "idt"]),
      invoiceValue: num(pick(r, ["invoice_value", "val", "total"])),
      taxableValue: num(pick(r, ["taxable_value", "txval", "taxable"])),
      igst: num(pick(r, ["igst", "iamt"])),
      cgst: num(pick(r, ["cgst", "camt"])),
      sgst: num(pick(r, ["sgst", "samt"])),
      cess: num(pick(r, ["cess", "csamt"])),
      itcAvailable: true,
    }))
    .filter((r) => r.invoiceNumber);
}

/** Persist 2B records for a period (replaces prior import for that period). */
export async function importGstr2bRecords(params: {
  organizationId: string;
  gstin: string;
  period: string;
  rows: Gstr2bRow[];
  source?: "GSP" | "EXCEL" | "CSV" | "JSON";
  importRecordId?: string;
}): Promise<{ count: number }> {
  const { organizationId, gstin, period, rows } = params;

  await prisma.$transaction(async (tx) => {
    await tx.gstr2bRecord.deleteMany({ where: { organizationId, gstin, period } });
    if (rows.length) {
      await tx.gstr2bRecord.createMany({
        data: rows.map((r) => ({
          organizationId,
          gstin,
          period,
          supplierGstin: r.supplierGstin,
          supplierName: r.supplierName,
          invoiceNumber: r.invoiceNumber,
          invoiceDate: r.invoiceDate ? new Date(r.invoiceDate) : null,
          invoiceValue: round2(r.invoiceValue ?? 0),
          taxableValue: round2(r.taxableValue ?? 0),
          igst: round2(r.igst ?? 0),
          cgst: round2(r.cgst ?? 0),
          sgst: round2(r.sgst ?? 0),
          cess: round2(r.cess ?? 0),
          itcAvailable: r.itcAvailable ?? true,
          source: params.source ?? "GSP",
          importRecordId: params.importRecordId,
        })),
      });
    }
  });

  return { count: rows.length };
}
