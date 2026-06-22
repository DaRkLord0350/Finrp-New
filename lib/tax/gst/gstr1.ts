// ============================================================
// lib/tax/gst/gstr1.ts
//
// Generate the GSTR-1 dataset + government-compatible JSON payload from
// the period's outward invoices. Produces the standard GSTN section
// structure (b2b / b2cl / b2cs / cdnr / exp / hsn) and persists a
// Gstr1Dataset row. Pure computation given the invoice rows.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { add, round2, toNumber } from "../core/money";
import { buildHsnSummary } from "./hsn";

type InvoiceWithLines = Prisma.GstInvoiceGetPayload<{ include: { lines: true } }>;

function ddmmyyyy(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getUTCFullYear()}`;
}

interface ItmDet {
  rt: number;
  txval: number;
  iamt: number;
  camt: number;
  samt: number;
  csamt: number;
}

/** Group an invoice's lines into rate-wise tax line items (GSTN itms). */
function buildItms(inv: InvoiceWithLines): { num: number; itm_det: ItmDet }[] {
  const byRate = new Map<number, ItmDet>();
  const lines = inv.lines.length
    ? inv.lines
    : [
        {
          gstRate: inferRate(inv),
          taxableValue: inv.taxableValue,
          igst: inv.igst,
          cgst: inv.cgst,
          sgst: inv.sgst,
          cess: inv.cess,
        },
      ];
  for (const l of lines) {
    const rt = toNumber(l.gstRate);
    const prev = byRate.get(rt) ?? { rt, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
    prev.txval = toNumber(add(prev.txval, l.taxableValue));
    prev.iamt = toNumber(add(prev.iamt, l.igst));
    prev.camt = toNumber(add(prev.camt, l.cgst));
    prev.samt = toNumber(add(prev.samt, l.sgst));
    prev.csamt = toNumber(add(prev.csamt, l.cess));
    byRate.set(rt, prev);
  }
  return [...byRate.values()].map((itm_det, i) => ({ num: i + 1, itm_det }));
}

function inferRate(inv: InvoiceWithLines): number {
  const taxable = toNumber(inv.taxableValue);
  if (taxable <= 0) return 0;
  const tax = toNumber(inv.igst) + toNumber(inv.cgst) + toNumber(inv.sgst);
  return Math.round((tax / taxable) * 10000) / 100;
}

export interface Gstr1Result {
  gstin: string;
  period: string;
  payload: Record<string, unknown>;
  summary: {
    b2bCount: number;
    b2clCount: number;
    b2csCount: number;
    cdnrCount: number;
    expCount: number;
    totalTaxable: number;
    totalTax: number;
  };
}

/** Build the GSTR-1 payload + summary (no DB writes). */
export async function buildGstr1(organizationId: string, gstin: string, period: string): Promise<Gstr1Result> {
  const invoices = await prisma.gstInvoice.findMany({
    where: { organizationId, period, direction: "OUTWARD", deletedAt: null },
    include: { lines: true },
  });

  // ── b2b (grouped by counterparty GSTIN) ──
  const b2bMap = new Map<string, Record<string, unknown>[]>();
  // ── b2cl (grouped by place of supply) ──
  const b2clMap = new Map<string, Record<string, unknown>[]>();
  // ── b2cs (aggregated by sply_ty + pos + rate) ──
  const b2csMap = new Map<string, ItmDet & { sply_ty: string; pos: string }>();
  // ── cdnr (grouped by counterparty GSTIN) ──
  const cdnrMap = new Map<string, Record<string, unknown>[]>();
  // ── exp ──
  const expInv: Record<string, unknown>[] = [];

  let totalTaxable = 0;
  let totalTax = 0;
  let b2csCount = 0;

  for (const inv of invoices) {
    const itms = buildItms(inv);
    const val = toNumber(inv.invoiceValue);
    const tax = toNumber(inv.igst) + toNumber(inv.cgst) + toNumber(inv.sgst);
    totalTaxable = toNumber(add(totalTaxable, inv.taxableValue));
    totalTax = toNumber(add(totalTax, tax));

    switch (inv.classification) {
      case "B2B": {
        const ctin = inv.counterpartyGstin ?? "UNKNOWN";
        const arr = b2bMap.get(ctin) ?? [];
        arr.push({ inum: inv.invoiceNumber, idt: ddmmyyyy(inv.invoiceDate), val, pos: inv.placeOfSupply ?? gstin.slice(0, 2), rchrg: inv.reverseCharge ? "Y" : "N", inv_typ: "R", itms });
        b2bMap.set(ctin, arr);
        break;
      }
      case "B2CL": {
        const pos = inv.placeOfSupply ?? "97";
        const arr = b2clMap.get(pos) ?? [];
        arr.push({ inum: inv.invoiceNumber, idt: ddmmyyyy(inv.invoiceDate), val, itms });
        b2clMap.set(pos, arr);
        break;
      }
      case "CDNR": {
        const ctin = inv.counterpartyGstin ?? "UNKNOWN";
        const arr = cdnrMap.get(ctin) ?? [];
        arr.push({ ntty: inv.docType === "DEBIT_NOTE" ? "D" : "C", nt_num: inv.invoiceNumber, nt_dt: ddmmyyyy(inv.invoiceDate), val, itms });
        cdnrMap.set(ctin, arr);
        break;
      }
      case "EXPORT": {
        expInv.push({ inum: inv.invoiceNumber, idt: ddmmyyyy(inv.invoiceDate), val, itms });
        break;
      }
      default: {
        // B2CS / NIL → aggregate by sply_ty + pos + rate
        const pos = inv.placeOfSupply ?? gstin.slice(0, 2);
        const splyTy = toNumber(inv.igst) > 0 ? "INTER" : "INTRA";
        for (const { itm_det } of itms) {
          const key = `${splyTy}::${pos}::${itm_det.rt}`;
          const prev = b2csMap.get(key) ?? { sply_ty: splyTy, pos, rt: itm_det.rt, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
          prev.txval = toNumber(add(prev.txval, itm_det.txval));
          prev.iamt = toNumber(add(prev.iamt, itm_det.iamt));
          prev.camt = toNumber(add(prev.camt, itm_det.camt));
          prev.samt = toNumber(add(prev.samt, itm_det.samt));
          prev.csamt = toNumber(add(prev.csamt, itm_det.csamt));
          b2csMap.set(key, prev);
        }
        b2csCount++;
      }
    }
  }

  // HSN section (outward)
  const hsnRows = await buildHsnSummary(organizationId, period, "OUTWARD");

  const payload = {
    gstin,
    fp: period,
    gt: round2(totalTaxable).toNumber(),
    cur_gt: round2(totalTaxable).toNumber(),
    b2b: [...b2bMap.entries()].map(([ctin, inv]) => ({ ctin, inv })),
    b2cl: [...b2clMap.entries()].map(([pos, inv]) => ({ pos, inv })),
    b2cs: [...b2csMap.values()].map((r) => ({ sply_ty: r.sply_ty, pos: r.pos, typ: "OE", rt: r.rt, txval: r.txval, iamt: r.iamt, camt: r.camt, samt: r.samt, csamt: r.csamt })),
    cdnr: [...cdnrMap.entries()].map(([ctin, nt]) => ({ ctin, nt })),
    exp: expInv.length ? [{ exp_typ: "WOPAY", inv: expInv }] : [],
    hsn: {
      data: hsnRows.map((h, i) => ({
        num: i + 1,
        hsn_sc: h.hsnSac,
        desc: h.description ?? "",
        uqc: h.uqc ?? "OTH",
        qty: h.totalQuantity,
        txval: round2(h.taxableValue).toNumber(),
        iamt: round2(h.igst).toNumber(),
        camt: round2(h.cgst).toNumber(),
        samt: round2(h.sgst).toNumber(),
        csamt: round2(h.cess).toNumber(),
        rt: h.gstRate,
      })),
    },
  };

  return {
    gstin,
    period,
    payload,
    summary: {
      b2bCount: b2bMap.size,
      b2clCount: b2clMap.size,
      b2csCount,
      cdnrCount: cdnrMap.size,
      expCount: expInv.length,
      totalTaxable: round2(totalTaxable).toNumber(),
      totalTax: round2(totalTax).toNumber(),
    },
  };
}

/** Build + persist the GSTR-1 dataset (upsert by org+gstin+period). */
export async function generateGstr1(
  organizationId: string,
  gstin: string,
  period: string,
  generatedById?: string
) {
  const result = await buildGstr1(organizationId, gstin, period);

  const dataset = await prisma.gstr1Dataset.upsert({
    where: { organizationId_gstin_period: { organizationId, gstin, period } },
    create: {
      organizationId,
      gstin,
      period,
      payload: result.payload as Prisma.InputJsonValue,
      summary: result.summary as Prisma.InputJsonValue,
      b2bCount: result.summary.b2bCount,
      b2clCount: result.summary.b2clCount,
      b2csCount: result.summary.b2csCount,
      cdnrCount: result.summary.cdnrCount,
      expCount: result.summary.expCount,
      totalTaxable: round2(result.summary.totalTaxable),
      totalTax: round2(result.summary.totalTax),
      generatedById,
    },
    update: {
      payload: result.payload as Prisma.InputJsonValue,
      summary: result.summary as Prisma.InputJsonValue,
      b2bCount: result.summary.b2bCount,
      b2clCount: result.summary.b2clCount,
      b2csCount: result.summary.b2csCount,
      cdnrCount: result.summary.cdnrCount,
      expCount: result.summary.expCount,
      totalTaxable: round2(result.summary.totalTaxable),
      totalTax: round2(result.summary.totalTax),
      generatedById,
    },
  });

  return { dataset, result };
}
