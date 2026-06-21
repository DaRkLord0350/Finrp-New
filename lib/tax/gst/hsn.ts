// ============================================================
// lib/tax/gst/hsn.ts
//
// Build the HSN/SAC summary for a GSTIN + period + direction by
// aggregating invoice lines, and persist GstHsnSummary rows. Used by
// GSTR-1 (outward HSN section) and analytics.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { GstSupplyDirection } from "@prisma/client";
import { add, round2, toNumber } from "../core/money";

export interface HsnSummaryRow {
  hsnSac: string;
  description?: string;
  uqc?: string;
  totalQuantity: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  gstRate: number;
  isService: boolean;
}

/** Aggregate invoice lines into HSN summary rows (in-memory). */
export async function buildHsnSummary(
  organizationId: string,
  period: string,
  direction: GstSupplyDirection
): Promise<HsnSummaryRow[]> {
  const invoices = await prisma.gstInvoice.findMany({
    where: { organizationId, period, direction, deletedAt: null },
    include: { lines: true },
  });

  const map = new Map<string, HsnSummaryRow>();
  for (const inv of invoices) {
    for (const l of inv.lines) {
      const hsn = l.hsnSac ?? "UNCLASSIFIED";
      const rate = toNumber(l.gstRate);
      const key = `${hsn}::${rate}::${l.isService ? "S" : "G"}`;
      const prev =
        map.get(key) ??
        {
          hsnSac: hsn,
          description: l.description ?? undefined,
          uqc: l.unit ?? undefined,
          totalQuantity: 0,
          taxableValue: 0,
          igst: 0,
          cgst: 0,
          sgst: 0,
          cess: 0,
          gstRate: rate,
          isService: l.isService,
        };
      prev.totalQuantity += toNumber(l.quantity ?? 0);
      prev.taxableValue = toNumber(add(prev.taxableValue, l.taxableValue));
      prev.igst = toNumber(add(prev.igst, l.igst));
      prev.cgst = toNumber(add(prev.cgst, l.cgst));
      prev.sgst = toNumber(add(prev.sgst, l.sgst));
      prev.cess = toNumber(add(prev.cess, l.cess));
      map.set(key, prev);
    }
  }
  return [...map.values()];
}

/** Compute + persist the HSN summary (replaces prior rows for the key). */
export async function persistHsnSummary(
  organizationId: string,
  period: string,
  direction: GstSupplyDirection
): Promise<HsnSummaryRow[]> {
  const rows = await buildHsnSummary(organizationId, period, direction);

  await prisma.$transaction(async (tx) => {
    await tx.gstHsnSummary.deleteMany({ where: { organizationId, period, direction } });
    for (const r of rows) {
      await tx.gstHsnSummary.create({
        data: {
          organizationId,
          period,
          direction,
          hsnSac: r.hsnSac,
          description: r.description,
          uqc: r.uqc,
          totalQuantity: round2(r.totalQuantity),
          taxableValue: round2(r.taxableValue),
          igst: round2(r.igst),
          cgst: round2(r.cgst),
          sgst: round2(r.sgst),
          cess: round2(r.cess),
          gstRate: r.gstRate,
          isService: r.isService,
        },
      });
    }
  });

  return rows;
}
