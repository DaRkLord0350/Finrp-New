// ============================================================
// lib/tax/gst/seed.ts
//
// Loads demo GST data for an org so the engine can be exercised
// end-to-end: a GST profile, a spread of outward + inward invoices,
// and a matching-ish GSTR-2B file with deliberate mismatches.
// All GSTINs carry valid checksums so validation passes.
// ============================================================

import { makeValidGstin } from "../core/pii";
import { resolveTaxConfig } from "../config/loader";
import { createGstInvoice } from "./ingest";
import { ensureGstProfile } from "./service";
import { importGstr2bRecords } from "./gstr2b";
import { seedDefaultRules } from "../validation/engine";
import { prisma } from "@/lib/prisma";

export const DEMO_OWN_GSTIN = makeValidGstin("27AAPFU0939F1Z"); // Maharashtra
const SUP1 = makeValidGstin("27AABCS1429B1Z"); // intra-state supplier
const SUP2 = makeValidGstin("29AABCS1429B1Z"); // inter-state supplier (Karnataka)
const CUST1 = makeValidGstin("24AAACI1681G1Z"); // registered customer (Gujarat)

function dateInPeriod(month: number, year: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export interface SeedResult {
  gstin: string;
  period: string;
  outwardCreated: number;
  inwardCreated: number;
  records2b: number;
  rulesSeeded: number;
}

/** Seed demo data for the given org + period (default May 2025 → "052025"). */
export async function seedGstDemo(params: {
  organizationId: string;
  createdById?: string;
  month?: number;
  year?: number;
}): Promise<SeedResult> {
  const month = params.month ?? 5;
  const year = params.year ?? 2025;
  const period = `${String(month).padStart(2, "0")}${year}`;
  const { organizationId } = params;

  await ensureGstProfile({
    organizationId,
    gstin: DEMO_OWN_GSTIN,
    legalName: "Demo Manufacturing LLP",
    isPrimary: true,
  });

  const config = await resolveTaxConfig({ scheme: "GST", period: "2025-26", organizationId });
  const b2clThreshold = config.gst.b2clThreshold;

  // Idempotency: clear any prior demo rows for this period.
  await prisma.gstInvoice.deleteMany({ where: { organizationId, period } });

  // ── Outward (sales) ──
  const outward = [
    // B2B intra-state (CGST+SGST)
    { num: "INV-001", gstin: CUST1, pos: "24", taxable: 100000, igst: 18000, cgst: 0, sgst: 0, val: 118000, dir: "inter" },
    { num: "INV-002", gstin: makeValidGstin("27AAACI1681G1Z"), pos: "27", taxable: 50000, igst: 0, cgst: 4500, sgst: 4500, val: 59000, dir: "intra" },
    // B2C large inter-state (≥ threshold)
    { num: "INV-003", gstin: undefined, pos: "29", taxable: 250000, igst: 45000, cgst: 0, sgst: 0, val: 295000, dir: "inter" },
    // B2C small intra-state
    { num: "INV-004", gstin: undefined, pos: "27", taxable: 8000, igst: 0, cgst: 720, sgst: 720, val: 9440, dir: "intra" },
  ];

  let outwardCreated = 0;
  for (const o of outward) {
    await createGstInvoice({
      organizationId,
      gstin: DEMO_OWN_GSTIN,
      createdById: params.createdById,
      b2clThreshold,
      source: "MANUAL",
      inv: {
        direction: "OUTWARD",
        docType: "INVOICE",
        counterpartyGstin: o.gstin,
        counterpartyName: o.gstin ? "Registered Customer" : "Walk-in Customer",
        invoiceNumber: o.num,
        invoiceDate: dateInPeriod(month, year, 10 + outwardCreated),
        placeOfSupply: o.pos,
        reverseCharge: false,
        isExport: false,
        invoiceValue: o.val,
        taxableValue: o.taxable,
        igst: o.igst,
        cgst: o.cgst,
        sgst: o.sgst,
        cess: 0,
        lines: [
          {
            hsnSac: "8471",
            description: "Goods",
            quantity: 1,
            taxableValue: o.taxable,
            gstRate: o.taxable > 0 ? Math.round(((o.igst + o.cgst + o.sgst) / o.taxable) * 10000) / 100 : 0,
            igst: o.igst,
            cgst: o.cgst,
            sgst: o.sgst,
            cess: 0,
          },
        ],
      },
    });
    outwardCreated++;
  }

  // ── Inward (purchases for ITC) ──
  const inward = [
    { num: "P-101", gstin: SUP1, taxable: 40000, igst: 0, cgst: 3600, sgst: 3600 }, // matches 2B
    { num: "P-102", gstin: SUP2, taxable: 60000, igst: 10800, cgst: 0, sgst: 0 }, // amount mismatch in 2B
    { num: "P-103", gstin: SUP1, taxable: 20000, igst: 0, cgst: 1800, sgst: 1800 }, // missing in 2B
  ];

  let inwardCreated = 0;
  for (const p of inward) {
    await createGstInvoice({
      organizationId,
      gstin: DEMO_OWN_GSTIN,
      createdById: params.createdById,
      b2clThreshold,
      source: "MANUAL",
      inv: {
        direction: "INWARD",
        docType: "INVOICE",
        counterpartyGstin: p.gstin,
        counterpartyName: "Supplier",
        invoiceNumber: p.num,
        invoiceDate: dateInPeriod(month, year, 5 + inwardCreated),
        placeOfSupply: "27",
        reverseCharge: false,
        isExport: false,
        invoiceValue: p.taxable + p.igst + p.cgst + p.sgst,
        taxableValue: p.taxable,
        igst: p.igst,
        cgst: p.cgst,
        sgst: p.sgst,
        cess: 0,
        itcEligible: true,
        lines: [
          {
            hsnSac: "8471",
            taxableValue: p.taxable,
            gstRate: p.taxable > 0 ? Math.round(((p.igst + p.cgst + p.sgst) / p.taxable) * 10000) / 100 : 0,
            igst: p.igst,
            cgst: p.cgst,
            sgst: p.sgst,
            cess: 0,
          },
        ],
      },
    });
    inwardCreated++;
  }

  // ── GSTR-2B (with intentional mismatches) ──
  const records2b = await importGstr2bRecords({
    organizationId,
    gstin: DEMO_OWN_GSTIN,
    period,
    source: "JSON",
    rows: [
      { supplierGstin: SUP1, supplierName: "Supplier 1", invoiceNumber: "P-101", taxableValue: 40000, cgst: 3600, sgst: 3600, igst: 0 }, // matches P-101
      { supplierGstin: SUP2, supplierName: "Supplier 2", invoiceNumber: "P-102", taxableValue: 60000, igst: 9800, cgst: 0, sgst: 0 }, // ₹1000 less → mismatch
      { supplierGstin: SUP1, supplierName: "Supplier 1", invoiceNumber: "P-199", taxableValue: 15000, cgst: 1350, sgst: 1350, igst: 0 }, // not in books → missing in books
    ],
  });

  const rulesSeeded = await seedDefaultRules("GST");

  return {
    gstin: DEMO_OWN_GSTIN,
    period,
    outwardCreated,
    inwardCreated,
    records2b: records2b.count,
    rulesSeeded,
  };
}
