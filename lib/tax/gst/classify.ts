// ============================================================
// lib/tax/gst/classify.ts
//
// Auto-classify a GST invoice into its GSTR-1 section bucket:
//   B2B    — supply to a registered person (recipient GSTIN present)
//   B2CL   — inter-state B2C invoice ≥ threshold (config)
//   B2CS   — all other B2C (intra-state, or inter-state < threshold)
//   EXPORT — export supply
//   CDNR   — credit/debit note to a registered person
//   CDNUR  — credit/debit note to an unregistered person
//   NIL_EXEMPT — nil-rated / exempt / non-GST
//
// Thresholds come from the versioned config (never hardcoded).
// ============================================================

import { ValidationEngine } from "@/lib/validation/engine";
import type { GstInvoiceClass, GstSupplyDirection } from "@prisma/client";

const gstinValidator = new ValidationEngine();

export interface ClassifyInput {
  direction: GstSupplyDirection;
  docType: string; // INVOICE | CREDIT_NOTE | DEBIT_NOTE | ...
  counterpartyGstin?: string | null;
  placeOfSupply?: string | null; // recipient state code
  supplierState?: string | null; // own state code (from filing GSTIN)
  isExport?: boolean;
  invoiceValue: number;
  taxableValue: number;
  taxAmount: number; // igst + cgst + sgst
}

function isRegistered(gstin?: string | null): boolean {
  if (!gstin) return false;
  return gstinValidator.validateGstin(gstin).valid;
}

/** Classify an invoice into its GSTR-1 section. */
export function classifyInvoice(input: ClassifyInput, b2clThreshold: number): GstInvoiceClass {
  const isNote = input.docType === "CREDIT_NOTE" || input.docType === "DEBIT_NOTE";

  // Inward (purchases) are tracked for ITC — bucket registered vs not.
  if (input.direction === "INWARD") {
    return isRegistered(input.counterpartyGstin) ? "B2B" : "B2CS";
  }

  // Nil / exempt / non-GST supply (no tax and no taxable value).
  if (input.taxAmount <= 0 && input.taxableValue <= 0) return "NIL_EXEMPT";

  if (input.isExport) return "EXPORT";

  if (isNote) {
    return isRegistered(input.counterpartyGstin) ? "CDNR" : "CDNUR";
  }

  if (isRegistered(input.counterpartyGstin)) return "B2B";

  // Unregistered recipient → B2C. Inter-state ≥ threshold ⇒ B2CL.
  const interState =
    !!input.placeOfSupply &&
    !!input.supplierState &&
    input.placeOfSupply !== input.supplierState;

  if (interState && input.invoiceValue >= b2clThreshold) return "B2CL";
  return "B2CS";
}
