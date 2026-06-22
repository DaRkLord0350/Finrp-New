// ============================================================
// lib/tax/validation/rules/gst.ts
//
// GST validation handlers + their default rule definitions. Handlers
// are pure functions of (subject, params, config). The subject for GST
// validation is a list of normalized invoices for one GSTIN + period.
// ============================================================

import { ValidationEngine } from "@/lib/validation/engine";
import type { RuleDefinition, RuleHandler, RuleIssue } from "../types";

const gstinValidator = new ValidationEngine();

export interface GstValidationInvoice {
  id?: string;
  classification: string;
  counterpartyGstin?: string | null;
  invoiceNumber: string;
  invoiceDate: string | Date;
  placeOfSupply?: string | null;
  taxableValue: number;
  invoiceValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
}

export interface GstValidationSubject {
  gstin: string;
  period: string; // MMYYYY
  invoices: GstValidationInvoice[];
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// ── Handlers ──────────────────────────────────────────────────

/** Own GSTIN must be structurally valid (format + checksum). */
const ownGstinValid: RuleHandler<GstValidationSubject> = ({ subject }) => {
  const res = gstinValidator.validateGstin(subject.gstin ?? "");
  return res.valid ? [] : [{ field: "gstin", message: res.error ?? "Invalid GSTIN", value: subject.gstin }];
};

/** B2B / CDNR invoices must carry a valid counterparty GSTIN. */
const b2bCounterpartyGstin: RuleHandler<GstValidationSubject> = ({ subject }) => {
  const issues: RuleIssue[] = [];
  subject.invoices.forEach((inv, i) => {
    const needsGstin = inv.classification === "B2B" || inv.classification === "CDNR";
    if (!needsGstin) return;
    const res = gstinValidator.validateGstin(inv.counterpartyGstin ?? "");
    if (!res.valid) {
      issues.push({
        field: "counterpartyGstin",
        pointer: `invoices[${i}]`,
        message: `Invoice ${inv.invoiceNumber}: B2B requires a valid recipient GSTIN`,
        value: inv.counterpartyGstin,
      });
    }
  });
  return issues;
};

/** An invoice must not mix IGST with CGST/SGST (inter vs intra-state). */
const taxHeadConsistency: RuleHandler<GstValidationSubject> = ({ subject }) => {
  const issues: RuleIssue[] = [];
  subject.invoices.forEach((inv, i) => {
    const hasIgst = num(inv.igst) > 0;
    const hasIntra = num(inv.cgst) > 0 || num(inv.sgst) > 0;
    if (hasIgst && hasIntra) {
      issues.push({
        pointer: `invoices[${i}]`,
        message: `Invoice ${inv.invoiceNumber}: IGST and CGST/SGST cannot both be charged`,
      });
    }
    if (num(inv.cgst).toFixed(2) !== num(inv.sgst).toFixed(2) && hasIntra) {
      issues.push({
        pointer: `invoices[${i}]`,
        message: `Invoice ${inv.invoiceNumber}: CGST (${inv.cgst}) and SGST (${inv.sgst}) must be equal`,
      });
    }
  });
  return issues;
};

/** Place of supply is mandatory for B2B and B2CL invoices. */
const placeOfSupplyRequired: RuleHandler<GstValidationSubject> = ({ subject }) => {
  const issues: RuleIssue[] = [];
  subject.invoices.forEach((inv, i) => {
    if ((inv.classification === "B2B" || inv.classification === "B2CL") && !inv.placeOfSupply) {
      issues.push({
        field: "placeOfSupply",
        pointer: `invoices[${i}]`,
        message: `Invoice ${inv.invoiceNumber}: place of supply is required`,
      });
    }
  });
  return issues;
};

/** Duplicate invoice numbers within the same period (per counterparty). */
const duplicateInvoiceNumbers: RuleHandler<GstValidationSubject> = ({ subject }) => {
  const seen = new Map<string, number>();
  const issues: RuleIssue[] = [];
  subject.invoices.forEach((inv, i) => {
    const key = `${inv.counterpartyGstin ?? "NA"}::${inv.invoiceNumber}`;
    if (seen.has(key)) {
      issues.push({
        field: "invoiceNumber",
        pointer: `invoices[${i}]`,
        message: `Duplicate invoice number ${inv.invoiceNumber} (also row ${seen.get(key)! + 1})`,
        value: inv.invoiceNumber,
      });
    } else {
      seen.set(key, i);
    }
  });
  return issues;
};

/** Effective tax rate must map to a configured GST slab (warning). */
const rateSlabCheck: RuleHandler<GstValidationSubject> = ({ subject, config }) => {
  const slabs = config.gst.rateSlabs;
  const issues: RuleIssue[] = [];
  subject.invoices.forEach((inv, i) => {
    const taxable = num(inv.taxableValue);
    if (taxable <= 0) return;
    const tax = num(inv.igst) + num(inv.cgst) + num(inv.sgst);
    const rate = Math.round((tax / taxable) * 10000) / 100; // 2-dp %
    if (rate === 0) return;
    const matches = slabs.some((s) => Math.abs(s - rate) < 0.05);
    if (!matches) {
      issues.push({
        pointer: `invoices[${i}]`,
        message: `Invoice ${inv.invoiceNumber}: effective rate ${rate}% is not a standard GST slab`,
        value: rate,
      });
    }
  });
  return issues;
};

/** Taxable value should be positive (warning — credit notes can be 0). */
const taxableValuePositive: RuleHandler<GstValidationSubject> = ({ subject }) => {
  const issues: RuleIssue[] = [];
  subject.invoices.forEach((inv, i) => {
    if (num(inv.taxableValue) <= 0 && inv.classification !== "NIL_EXEMPT") {
      issues.push({
        field: "taxableValue",
        pointer: `invoices[${i}]`,
        message: `Invoice ${inv.invoiceNumber}: taxable value is not positive`,
        value: inv.taxableValue,
      });
    }
  });
  return issues;
};

// ── Registry of GST handlers ──────────────────────────────────
export const GST_HANDLERS: Record<string, RuleHandler<GstValidationSubject>> = {
  "gst.ownGstinValid": ownGstinValid,
  "gst.b2bCounterpartyGstin": b2bCounterpartyGstin,
  "gst.taxHeadConsistency": taxHeadConsistency,
  "gst.placeOfSupplyRequired": placeOfSupplyRequired,
  "gst.duplicateInvoiceNumbers": duplicateInvoiceNumbers,
  "gst.rateSlabCheck": rateSlabCheck,
  "gst.taxableValuePositive": taxableValuePositive,
};

// ── Default rule definitions (seed + zero-config behaviour) ───
export const GST_RULE_DEFINITIONS: RuleDefinition[] = [
  {
    code: "GST_OWN_GSTIN_VALID",
    scheme: "GST",
    name: "Valid filing GSTIN",
    explanation: "The GSTIN under which the return is filed must pass format + checksum validation.",
    severity: "ERROR",
    blocking: true,
    handlerKey: "gst.ownGstinValid",
  },
  {
    code: "GST_B2B_COUNTERPARTY_GSTIN",
    scheme: "GST",
    name: "B2B recipient GSTIN present & valid",
    explanation: "B2B and credit/debit note (registered) entries require the recipient's valid GSTIN for GSTR-1.",
    severity: "ERROR",
    blocking: true,
    handlerKey: "gst.b2bCounterpartyGstin",
  },
  {
    code: "GST_TAX_HEAD_CONSISTENCY",
    scheme: "GST",
    name: "Tax head consistency",
    explanation: "An invoice is either inter-state (IGST) or intra-state (CGST+SGST equal halves) — never both.",
    severity: "ERROR",
    blocking: true,
    handlerKey: "gst.taxHeadConsistency",
  },
  {
    code: "GST_PLACE_OF_SUPPLY",
    scheme: "GST",
    name: "Place of supply required",
    explanation: "B2B and B2C-large invoices must declare a place of supply (state code).",
    severity: "ERROR",
    blocking: true,
    handlerKey: "gst.placeOfSupplyRequired",
  },
  {
    code: "GST_DUPLICATE_INVOICE",
    scheme: "GST",
    name: "Duplicate invoice numbers",
    explanation: "GSTR-1 rejects duplicate invoice numbers for the same recipient within a period.",
    severity: "ERROR",
    blocking: true,
    handlerKey: "gst.duplicateInvoiceNumbers",
  },
  {
    code: "GST_RATE_SLAB",
    scheme: "GST",
    name: "Standard GST rate slab",
    explanation: "The effective tax rate should match a notified slab; non-standard rates often indicate data entry errors.",
    severity: "WARNING",
    blocking: false,
    handlerKey: "gst.rateSlabCheck",
  },
  {
    code: "GST_TAXABLE_POSITIVE",
    scheme: "GST",
    name: "Positive taxable value",
    explanation: "Taxable value should be greater than zero for taxable supplies.",
    severity: "WARNING",
    blocking: false,
    handlerKey: "gst.taxableValuePositive",
  },
];
