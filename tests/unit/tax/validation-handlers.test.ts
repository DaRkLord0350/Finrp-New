// ============================================================
// Unit tests — GST validation rule handlers (pure, no DB)
// ============================================================

import { describe, it, expect } from "vitest";
import { GST_HANDLERS, type GstValidationSubject } from "@/lib/tax/validation/rules/gst";
import { FY_2025_26 } from "@/lib/tax/config/packs/fy-2025-26";
import { makeValidGstin } from "@/lib/tax/core/pii";

const OWN = makeValidGstin("27AAPFU0939F1Z");
const REG = makeValidGstin("24AAACI1681G1Z");

function run(handlerKey: string, subject: GstValidationSubject) {
  return GST_HANDLERS[handlerKey]({ subject, params: {}, config: FY_2025_26, organizationId: "org" });
}

function invoice(over: Partial<GstValidationSubject["invoices"][0]> = {}) {
  return {
    classification: "B2B",
    counterpartyGstin: REG,
    invoiceNumber: "INV-1",
    invoiceDate: "2025-05-10",
    placeOfSupply: "24",
    taxableValue: 1000,
    invoiceValue: 1180,
    igst: 180,
    cgst: 0,
    sgst: 0,
    cess: 0,
    ...over,
  };
}

describe("GST validation handlers", () => {
  it("flags an invalid filing GSTIN", async () => {
    expect(await run("gst.ownGstinValid", { gstin: "BADGSTIN", period: "052025", invoices: [] })).toHaveLength(1);
    expect(await run("gst.ownGstinValid", { gstin: OWN, period: "052025", invoices: [] })).toHaveLength(0);
  });

  it("requires a valid recipient GSTIN on B2B", async () => {
    const bad = await run("gst.b2bCounterpartyGstin", { gstin: OWN, period: "052025", invoices: [invoice({ counterpartyGstin: "XYZ" })] });
    expect(bad).toHaveLength(1);
    const ok = await run("gst.b2bCounterpartyGstin", { gstin: OWN, period: "052025", invoices: [invoice()] });
    expect(ok).toHaveLength(0);
  });

  it("rejects mixing IGST with CGST/SGST", async () => {
    const issues = await run("gst.taxHeadConsistency", {
      gstin: OWN, period: "052025",
      invoices: [invoice({ igst: 100, cgst: 50, sgst: 50 })],
    });
    expect(issues.length).toBeGreaterThanOrEqual(1);
  });

  it("detects duplicate invoice numbers", async () => {
    const issues = await run("gst.duplicateInvoiceNumbers", {
      gstin: OWN, period: "052025",
      invoices: [invoice({ invoiceNumber: "DUP" }), invoice({ invoiceNumber: "DUP" })],
    });
    expect(issues).toHaveLength(1);
  });

  it("warns on a non-standard rate slab", async () => {
    const issues = await run("gst.rateSlabCheck", {
      gstin: OWN, period: "052025",
      invoices: [invoice({ taxableValue: 1000, igst: 137, cgst: 0, sgst: 0 })], // 13.7% — not a slab
    });
    expect(issues).toHaveLength(1);
  });

  it("accepts a clean B2B invoice across all handlers", async () => {
    const subject: GstValidationSubject = { gstin: OWN, period: "052025", invoices: [invoice()] };
    for (const key of Object.keys(GST_HANDLERS)) {
      expect(await run(key, subject)).toHaveLength(0);
    }
  });
});
