// ============================================================
// lib/tax/gst/ingest.ts
//
// Normalize raw imported rows into GstInvoice rows (with classification)
// and provide a structured create path for manual entry. Each import
// row maps to one invoice + one line; richer multi-line invoices come
// through the structured `createGstInvoice` path.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { GstDocType, GstSupplyDirection, TaxImportSource } from "@prisma/client";
import type { RawRow, RowNormalizeResult } from "../import/types";
import { ingestImportBatch, markRecordCommitted, finalizeBatch } from "../import/ingest";
import { round2, D } from "../core/money";
import { gstReturnPeriod, stateCodeOfGstin } from "../core/period";
import { resolveTaxConfig } from "../config/loader";
import { classifyInvoice } from "./classify";
import type { NormalizedGstInvoice } from "./types";

// ── Flexible header lookup ────────────────────────────────────
function pick(raw: RawRow, keys: string[]): string | undefined {
  const lower = new Map<string, unknown>();
  for (const [k, v] of Object.entries(raw)) lower.set(k.toLowerCase().replace(/[\s_]+/g, ""), v);
  for (const key of keys) {
    const hit = lower.get(key.toLowerCase().replace(/[\s_]+/g, ""));
    if (hit !== undefined && hit !== null && hit !== "") return String(hit).trim();
  }
  return undefined;
}

function n(v: string | undefined): number {
  if (v === undefined) return 0;
  const num = Number(v.replace(/[, ]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function toIsoDate(v: string | undefined): string | null {
  if (!v) return null;
  // Accept dd-mm-yyyy, dd/mm/yyyy, yyyy-mm-dd, ISO.
  const dmY = v.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmY) {
    const [, d, m, y] = dmY;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/** Project a raw import row into a normalized single-line invoice. */
export function normalizeGstRow(
  direction: GstSupplyDirection
): (raw: RawRow, index: number) => RowNormalizeResult<NormalizedGstInvoice> {
  return (raw, _index) => {
    const errors: { field?: string; message: string }[] = [];

    const invoiceNumber = pick(raw, ["invoice_number", "invoice no", "invoiceno", "bill no", "inum", "voucher number"]);
    const invoiceDateRaw = pick(raw, ["invoice_date", "date", "idt", "voucher date"]);
    const invoiceDate = toIsoDate(invoiceDateRaw);

    if (!invoiceNumber) errors.push({ field: "invoiceNumber", message: "Missing invoice number" });
    if (!invoiceDate) errors.push({ field: "invoiceDate", message: `Invalid/missing invoice date "${invoiceDateRaw ?? ""}"` });

    const taxableValue = n(pick(raw, ["taxable_value", "taxable", "txval", "amount", "taxable amount"]));
    const igst = n(pick(raw, ["igst", "igst_amount", "iamt"]));
    const cgst = n(pick(raw, ["cgst", "cgst_amount", "camt"]));
    const sgst = n(pick(raw, ["sgst", "sgst_amount", "samt"]));
    const cess = n(pick(raw, ["cess", "cess_amount", "csamt"]));
    const invoiceValue = n(pick(raw, ["invoice_value", "total", "val", "grand total"])) || taxableValue + igst + cgst + sgst + cess;
    const gstRate = taxableValue > 0 ? Math.round(((igst + cgst + sgst) / taxableValue) * 10000) / 100 : 0;

    const docTypeRaw = (pick(raw, ["doc_type", "document type", "note type"]) ?? "INVOICE").toUpperCase();
    const docType: GstDocType =
      docTypeRaw.includes("CREDIT") ? "CREDIT_NOTE" : docTypeRaw.includes("DEBIT") ? "DEBIT_NOTE" : "INVOICE";

    const reverseCharge = /^(y|yes|true|1)$/i.test(pick(raw, ["reverse_charge", "rchrg"]) ?? "");
    const isExport = /^(y|yes|true|1)$/i.test(pick(raw, ["export", "is_export"]) ?? "") ||
      /export/i.test(pick(raw, ["doc_type", "supply_type"]) ?? "");

    const normalized: NormalizedGstInvoice = {
      direction,
      docType,
      counterpartyGstin: pick(raw, ["gstin", "counterparty_gstin", "recipient_gstin", "supplier_gstin", "ctin", "party gstin"]),
      counterpartyName: pick(raw, ["counterparty", "party", "name", "trade name", "customer", "supplier"]),
      counterpartyState: pick(raw, ["counterparty_state", "party_state"]),
      invoiceNumber: invoiceNumber ?? "",
      invoiceDate: invoiceDate ?? "",
      placeOfSupply: pick(raw, ["place_of_supply", "pos", "state_code"]),
      reverseCharge,
      isExport,
      invoiceValue,
      taxableValue,
      igst,
      cgst,
      sgst,
      cess,
      itcEligible: direction === "INWARD",
      lines: [
        {
          hsnSac: pick(raw, ["hsn", "hsn_sac", "hsn code", "sac"]),
          description: pick(raw, ["description", "item", "particulars"]),
          quantity: n(pick(raw, ["quantity", "qty"])) || undefined,
          unit: pick(raw, ["unit", "uqc", "uom"]),
          rate: n(pick(raw, ["rate", "price"])) || undefined,
          taxableValue,
          gstRate,
          igst,
          cgst,
          sgst,
          cess,
          isService: /^(y|yes|true|1)$/i.test(pick(raw, ["is_service", "service"]) ?? ""),
        },
      ],
    };

    return { normalized, errors: errors.length ? errors : undefined };
  };
}

// ── Structured create (manual entry + commit from batch) ──────
export async function createGstInvoice(params: {
  organizationId: string;
  gstin: string;
  profileId?: string | null;
  supplierState?: string | null;
  inv: NormalizedGstInvoice;
  importRecordId?: string;
  source?: TaxImportSource;
  createdById?: string;
  b2clThreshold: number;
}): Promise<string> {
  const { inv } = params;
  const taxAmount = inv.igst + inv.cgst + inv.sgst;
  const supplierState = params.supplierState ?? stateCodeOfGstin(params.gstin);

  const classification = classifyInvoice(
    {
      direction: inv.direction,
      docType: inv.docType,
      counterpartyGstin: inv.counterpartyGstin,
      placeOfSupply: inv.placeOfSupply,
      supplierState,
      isExport: inv.isExport,
      invoiceValue: inv.invoiceValue,
      taxableValue: inv.taxableValue,
      taxAmount,
    },
    params.b2clThreshold
  );

  const period = gstReturnPeriod(new Date(inv.invoiceDate));
  const isInward = inv.direction === "INWARD";
  const itcEligible = inv.itcEligible ?? isInward;

  const created = await prisma.gstInvoice.create({
    data: {
      organizationId: params.organizationId,
      profileId: params.profileId ?? null,
      importRecordId: params.importRecordId,
      direction: inv.direction,
      docType: inv.docType,
      classification,
      counterpartyGstin: inv.counterpartyGstin,
      counterpartyName: inv.counterpartyName,
      counterpartyState: inv.counterpartyState ?? stateCodeOfGstin(inv.counterpartyGstin) ?? inv.placeOfSupply,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: new Date(inv.invoiceDate),
      period,
      placeOfSupply: inv.placeOfSupply,
      reverseCharge: inv.reverseCharge,
      isExport: inv.isExport,
      exportType: inv.exportType,
      invoiceValue: round2(inv.invoiceValue),
      taxableValue: round2(inv.taxableValue),
      igst: round2(inv.igst),
      cgst: round2(inv.cgst),
      sgst: round2(inv.sgst),
      cess: round2(inv.cess),
      itcEligible,
      itcIgst: round2(isInward && itcEligible ? inv.igst : 0),
      itcCgst: round2(isInward && itcEligible ? inv.cgst : 0),
      itcSgst: round2(isInward && itcEligible ? inv.sgst : 0),
      itcCess: round2(isInward && itcEligible ? inv.cess : 0),
      source: params.source ?? "MANUAL",
      createdById: params.createdById,
      lines: {
        create: inv.lines.map((l) => ({
          organizationId: params.organizationId,
          hsnSac: l.hsnSac,
          description: l.description,
          quantity: l.quantity != null ? D(l.quantity) : null,
          unit: l.unit,
          rate: l.rate != null ? round2(l.rate) : null,
          taxableValue: round2(l.taxableValue),
          gstRate: D(l.gstRate),
          cessRate: D(l.cessRate ?? 0),
          igst: round2(l.igst),
          cgst: round2(l.cgst),
          sgst: round2(l.sgst),
          cess: round2(l.cess),
          isService: l.isService ?? false,
        })),
      },
    },
  });

  return created.id;
}

// ── End-to-end import: parse → ingest batch → commit invoices ─
export async function importGstInvoices(params: {
  organizationId: string;
  gstin: string;
  profileId?: string | null;
  supplierState?: string | null;
  direction: GstSupplyDirection;
  source: TaxImportSource;
  fileName?: string;
  rows: RawRow[];
  rawPayload?: unknown;
  createdById?: string;
}): Promise<{ batchId: string; committed: number; invalid: number }> {
  const config = await resolveTaxConfig({ scheme: "GST", period: "2025-26", organizationId: params.organizationId });
  const b2clThreshold = config.gst.b2clThreshold;

  const ingest = await ingestImportBatch<NormalizedGstInvoice>({
    organizationId: params.organizationId,
    scheme: "GST",
    module: params.direction === "OUTWARD" ? "GST_SALES" : "GST_PURCHASES",
    source: params.source,
    fileName: params.fileName,
    createdById: params.createdById,
    rows: params.rows,
    rawPayload: params.rawPayload as never,
    normalize: normalizeGstRow(params.direction),
  });

  // Commit the VALID, normalized records into GstInvoice rows.
  const validRecords = await prisma.taxImportRecord.findMany({
    where: { batchId: ingest.batchId, status: "VALID" },
    orderBy: { rowIndex: "asc" },
  });

  let committed = 0;
  for (const rec of validRecords) {
    const inv = rec.normalized as unknown as NormalizedGstInvoice | null;
    if (!inv) continue;
    const invoiceId = await createGstInvoice({
      organizationId: params.organizationId,
      gstin: params.gstin,
      profileId: params.profileId,
      supplierState: params.supplierState,
      inv,
      importRecordId: rec.id,
      source: params.source,
      createdById: params.createdById,
      b2clThreshold,
    });
    await markRecordCommitted(rec.id, "GstInvoice", invoiceId);
    committed++;
  }

  await finalizeBatch(ingest.batchId, committed);
  return { batchId: ingest.batchId, committed, invalid: ingest.errorCount };
}
