// ============================================================
// Unit tests — GST invoice auto-classification
// ============================================================

import { describe, it, expect } from "vitest";
import { classifyInvoice } from "@/lib/tax/gst/classify";
import { makeValidGstin } from "@/lib/tax/core/pii";

const THRESHOLD = 100000;
const REG_GSTIN = makeValidGstin("24AAACI1681G1Z"); // Gujarat registered

function base(over: Partial<Parameters<typeof classifyInvoice>[0]> = {}) {
  return classifyInvoice(
    {
      direction: "OUTWARD",
      docType: "INVOICE",
      counterpartyGstin: undefined,
      placeOfSupply: "27",
      supplierState: "27",
      isExport: false,
      invoiceValue: 1000,
      taxableValue: 1000,
      taxAmount: 180,
      ...over,
    },
    THRESHOLD
  );
}

describe("classifyInvoice", () => {
  it("registered recipient → B2B", () => {
    expect(base({ counterpartyGstin: REG_GSTIN, placeOfSupply: "24", supplierState: "27" })).toBe("B2B");
  });

  it("export supply → EXPORT", () => {
    expect(base({ isExport: true })).toBe("EXPORT");
  });

  it("unregistered inter-state ≥ threshold → B2CL", () => {
    expect(base({ counterpartyGstin: undefined, placeOfSupply: "29", supplierState: "27", invoiceValue: 250000, taxableValue: 250000 })).toBe("B2CL");
  });

  it("unregistered inter-state < threshold → B2CS", () => {
    expect(base({ placeOfSupply: "29", supplierState: "27", invoiceValue: 5000, taxableValue: 5000 })).toBe("B2CS");
  });

  it("unregistered intra-state → B2CS", () => {
    expect(base({ placeOfSupply: "27", supplierState: "27", invoiceValue: 250000, taxableValue: 250000 })).toBe("B2CS");
  });

  it("credit note to registered → CDNR", () => {
    expect(base({ docType: "CREDIT_NOTE", counterpartyGstin: REG_GSTIN })).toBe("CDNR");
  });

  it("credit note to unregistered → CDNUR", () => {
    expect(base({ docType: "CREDIT_NOTE", counterpartyGstin: undefined })).toBe("CDNUR");
  });

  it("nil / no-tax supply → NIL_EXEMPT", () => {
    expect(base({ taxAmount: 0, taxableValue: 0, invoiceValue: 0 })).toBe("NIL_EXEMPT");
  });

  it("inward registered purchase → B2B", () => {
    expect(base({ direction: "INWARD", counterpartyGstin: REG_GSTIN })).toBe("B2B");
  });
});
