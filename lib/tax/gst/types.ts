// ============================================================
// lib/tax/gst/types.ts
//
// Normalized invoice shape the GST engine works with internally,
// independent of import source (CSV/Excel/Tally/manual).
// ============================================================

import type { GstDocType, GstSupplyDirection } from "@prisma/client";

export interface NormalizedGstLine {
  hsnSac?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  rate?: number;
  taxableValue: number;
  gstRate: number;
  cessRate?: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  isService?: boolean;
}

export interface NormalizedGstInvoice {
  direction: GstSupplyDirection;
  docType: GstDocType;
  counterpartyGstin?: string;
  counterpartyName?: string;
  counterpartyState?: string;
  invoiceNumber: string;
  invoiceDate: string; // ISO date
  placeOfSupply?: string; // state code
  reverseCharge: boolean;
  isExport: boolean;
  exportType?: string;
  invoiceValue: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  itcEligible?: boolean;
  lines: NormalizedGstLine[];
}
