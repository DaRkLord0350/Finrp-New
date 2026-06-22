// ============================================================
// lib/tax/gst/gstr3b.ts
//
// Compute GSTR-3B for a GSTIN + period: outward tax liability, ITC
// available (current period + carried-forward closing balance), the
// statutory ITC set-off order, net cash payable, and the closing ITC
// balance carried into the next period.
//
// Set-off order implemented (CGST Rules 88A simplified):
//   • IGST liability ← IGST credit
//   • CGST liability ← CGST credit, then leftover IGST credit
//   • SGST liability ← SGST credit, then leftover IGST credit
//   • Cess           ← Cess credit
// ============================================================

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { round2, toNumber } from "../core/money";
import { prevGstPeriod } from "../core/period";

const max0 = (n: number) => (n > 0 ? n : 0);
const min = (a: number, b: number) => (a < b ? a : b);

export interface TaxHeads {
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
}

/**
 * Pure ITC set-off (CGST Rules 88A simplified). Given outward liability,
 * this period's ITC, and the carried-forward closing balance, returns the
 * net cash payable per head and the new closing ITC balance.
 *
 * Order: IGST liability ← IGST credit; CGST/SGST ← own credit then leftover
 * IGST credit; Cess ← Cess credit.
 */
export function applyItcSetOff(
  outward: TaxHeads,
  itc: TaxHeads,
  carriedForward: TaxHeads
): { netPayable: TaxHeads; closing: TaxHeads } {
  const availIgst = itc.igst + carriedForward.igst;
  const availCgst = itc.cgst + carriedForward.cgst;
  const availSgst = itc.sgst + carriedForward.sgst;
  const availCess = itc.cess + carriedForward.cess;

  let igstCredit = availIgst;
  const payIgst = max0(outward.igst - igstCredit);
  igstCredit = max0(igstCredit - outward.igst);

  let payCgst = max0(outward.cgst - availCgst);
  const closingCgst = max0(availCgst - outward.cgst);
  const useIgstForCgst = min(payCgst, igstCredit);
  payCgst -= useIgstForCgst;
  igstCredit -= useIgstForCgst;

  let paySgst = max0(outward.sgst - availSgst);
  const closingSgst = max0(availSgst - outward.sgst);
  const useIgstForSgst = min(paySgst, igstCredit);
  paySgst -= useIgstForSgst;
  igstCredit -= useIgstForSgst;

  const payCess = max0(outward.cess - availCess);
  const closingCess = max0(availCess - outward.cess);

  return {
    netPayable: { igst: payIgst, cgst: payCgst, sgst: paySgst, cess: payCess },
    closing: { igst: igstCredit, cgst: closingCgst, sgst: closingSgst, cess: closingCess },
  };
}

export interface Gstr3bResult {
  gstin: string;
  period: string;
  outward: { taxable: number; igst: number; cgst: number; sgst: number; cess: number };
  itc: { igst: number; cgst: number; sgst: number; cess: number };
  carriedForward: { igst: number; cgst: number; sgst: number; cess: number };
  netPayable: { igst: number; cgst: number; sgst: number; cess: number };
  closing: { igst: number; cgst: number; sgst: number; cess: number };
  payload: Record<string, unknown>;
}

export async function computeGstr3bValues(
  organizationId: string,
  gstin: string,
  period: string
): Promise<Gstr3bResult> {
  const [out, itcAgg, cf] = await Promise.all([
    prisma.gstInvoice.aggregate({
      where: { organizationId, period, direction: "OUTWARD", deletedAt: null },
      _sum: { taxableValue: true, igst: true, cgst: true, sgst: true, cess: true },
    }),
    prisma.gstInvoice.aggregate({
      where: { organizationId, period, direction: "INWARD", itcEligible: true, deletedAt: null },
      _sum: { itcIgst: true, itcCgst: true, itcSgst: true, itcCess: true },
    }),
    prisma.gstCarryForward.findUnique({
      where: { organizationId_gstin_period: { organizationId, gstin, period: prevGstPeriod(period) } },
    }),
  ]);

  const outward = {
    taxable: toNumber(out._sum.taxableValue),
    igst: toNumber(out._sum.igst),
    cgst: toNumber(out._sum.cgst),
    sgst: toNumber(out._sum.sgst),
    cess: toNumber(out._sum.cess),
  };
  const itc = {
    igst: toNumber(itcAgg._sum.itcIgst),
    cgst: toNumber(itcAgg._sum.itcCgst),
    sgst: toNumber(itcAgg._sum.itcSgst),
    cess: toNumber(itcAgg._sum.itcCess),
  };
  const carriedForward = {
    igst: toNumber(cf?.itcIgstClosing),
    cgst: toNumber(cf?.itcCgstClosing),
    sgst: toNumber(cf?.itcSgstClosing),
    cess: toNumber(cf?.itcCessClosing),
  };

  // Available credit per head = this period's ITC + carried-forward closing.
  const availIgst = itc.igst + carriedForward.igst;
  const availCgst = itc.cgst + carriedForward.cgst;
  const availSgst = itc.sgst + carriedForward.sgst;
  const availCess = itc.cess + carriedForward.cess;

  const { netPayable, closing } = applyItcSetOff(outward, itc, carriedForward);

  const payload = {
    gstin,
    ret_period: period,
    sup_details: {
      osup_det: {
        txval: round2(outward.taxable).toNumber(),
        iamt: round2(outward.igst).toNumber(),
        camt: round2(outward.cgst).toNumber(),
        samt: round2(outward.sgst).toNumber(),
        csamt: round2(outward.cess).toNumber(),
      },
    },
    itc_elg: {
      itc_avl: [
        {
          ty: "ISRC",
          iamt: round2(itc.igst).toNumber(),
          camt: round2(itc.cgst).toNumber(),
          samt: round2(itc.sgst).toNumber(),
          csamt: round2(itc.cess).toNumber(),
        },
      ],
      itc_net: {
        iamt: round2(availIgst).toNumber(),
        camt: round2(availCgst).toNumber(),
        samt: round2(availSgst).toNumber(),
        csamt: round2(availCess).toNumber(),
      },
    },
    tx_pmt: {
      net_cash: {
        iamt: round2(netPayable.igst).toNumber(),
        camt: round2(netPayable.cgst).toNumber(),
        samt: round2(netPayable.sgst).toNumber(),
        csamt: round2(netPayable.cess).toNumber(),
      },
    },
  };

  return { gstin, period, outward, itc, carriedForward, netPayable, closing, payload };
}

/** Compute, persist the computation, and update the carry-forward row. */
export async function computeGstr3b(
  organizationId: string,
  gstin: string,
  period: string,
  computedById?: string
) {
  const r = await computeGstr3bValues(organizationId, gstin, period);

  const computation = await prisma.$transaction(async (tx) => {
    const comp = await tx.gstr3bComputation.upsert({
      where: { organizationId_gstin_period: { organizationId, gstin, period } },
      create: {
        organizationId,
        gstin,
        period,
        outwardTaxable: round2(r.outward.taxable),
        outwardIgst: round2(r.outward.igst),
        outwardCgst: round2(r.outward.cgst),
        outwardSgst: round2(r.outward.sgst),
        outwardCess: round2(r.outward.cess),
        itcIgst: round2(r.itc.igst),
        itcCgst: round2(r.itc.cgst),
        itcSgst: round2(r.itc.sgst),
        itcCess: round2(r.itc.cess),
        netIgst: round2(r.netPayable.igst),
        netCgst: round2(r.netPayable.cgst),
        netSgst: round2(r.netPayable.sgst),
        netCess: round2(r.netPayable.cess),
        payload: r.payload as Prisma.InputJsonValue,
        computedById,
      },
      update: {
        outwardTaxable: round2(r.outward.taxable),
        outwardIgst: round2(r.outward.igst),
        outwardCgst: round2(r.outward.cgst),
        outwardSgst: round2(r.outward.sgst),
        outwardCess: round2(r.outward.cess),
        itcIgst: round2(r.itc.igst),
        itcCgst: round2(r.itc.cgst),
        itcSgst: round2(r.itc.sgst),
        itcCess: round2(r.itc.cess),
        netIgst: round2(r.netPayable.igst),
        netCgst: round2(r.netPayable.cgst),
        netSgst: round2(r.netPayable.sgst),
        netCess: round2(r.netPayable.cess),
        payload: r.payload as Prisma.InputJsonValue,
        computedById,
      },
    });

    await tx.gstCarryForward.upsert({
      where: { organizationId_gstin_period: { organizationId, gstin, period } },
      create: {
        organizationId,
        gstin,
        period,
        itcIgstClosing: round2(r.closing.igst),
        itcCgstClosing: round2(r.closing.cgst),
        itcSgstClosing: round2(r.closing.sgst),
        itcCessClosing: round2(r.closing.cess),
      },
      update: {
        itcIgstClosing: round2(r.closing.igst),
        itcCgstClosing: round2(r.closing.cgst),
        itcSgstClosing: round2(r.closing.sgst),
        itcCessClosing: round2(r.closing.cess),
      },
    });

    return comp;
  });

  return { computation, result: r };
}
