// ============================================================
// /api/tax/gst/invoices
// GET  — list GST invoices (filter by period/direction/classification)
// POST — manual structured invoice entry
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/require-tenant";
import { prisma } from "@/lib/prisma";
import { resolveTaxConfig } from "@/lib/tax/config/loader";
import { createGstInvoice } from "@/lib/tax/gst/ingest";
import { getPrimaryGstin } from "@/lib/tax/gst/service";
import { taxAudit } from "@/lib/tax/core/audit";

export const GET = withTenant(async (req, { organizationId }) => {
  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? undefined;
  const direction = url.searchParams.get("direction") as "OUTWARD" | "INWARD" | null;
  const take = Math.min(Number(url.searchParams.get("take") ?? 100), 500);

  const invoices = await prisma.gstInvoice.findMany({
    where: {
      organizationId,
      deletedAt: null,
      ...(period ? { period } : {}),
      ...(direction ? { direction } : {}),
    },
    orderBy: { invoiceDate: "desc" },
    take,
    include: { lines: true },
  });
  return NextResponse.json({ invoices });
}, { permission: "tax.read" });

const LineSchema = z.object({
  hsnSac: z.string().optional(),
  description: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  rate: z.number().optional(),
  taxableValue: z.number(),
  gstRate: z.number(),
  cessRate: z.number().optional(),
  igst: z.number(),
  cgst: z.number(),
  sgst: z.number(),
  cess: z.number(),
  isService: z.boolean().optional(),
});

const CreateInvoiceSchema = z.object({
  gstin: z.string().length(15).optional(),
  direction: z.enum(["OUTWARD", "INWARD"]),
  docType: z.enum(["INVOICE", "CREDIT_NOTE", "DEBIT_NOTE", "BILL_OF_SUPPLY", "ADVANCE_RECEIPT"]).default("INVOICE"),
  counterpartyGstin: z.string().optional(),
  counterpartyName: z.string().optional(),
  counterpartyState: z.string().optional(),
  invoiceNumber: z.string().min(1),
  invoiceDate: z.string(),
  placeOfSupply: z.string().optional(),
  reverseCharge: z.boolean().default(false),
  isExport: z.boolean().default(false),
  invoiceValue: z.number(),
  taxableValue: z.number(),
  igst: z.number().default(0),
  cgst: z.number().default(0),
  sgst: z.number().default(0),
  cess: z.number().default(0),
  lines: z.array(LineSchema).optional(),
});

export const POST = withTenant(async (req, { organizationId, userId }) => {
  const body = await req.json().catch(() => null);
  const parsed = CreateInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const gstin = data.gstin ?? (await getPrimaryGstin(organizationId));
  if (!gstin) {
    return NextResponse.json({ error: "No GST profile found — add a GSTIN first" }, { status: 400 });
  }

  const config = await resolveTaxConfig({ scheme: "GST", period: "2025-26", organizationId });

  const invoiceId = await createGstInvoice({
    organizationId,
    gstin,
    createdById: userId,
    b2clThreshold: config.gst.b2clThreshold,
    source: "MANUAL",
    inv: {
      direction: data.direction,
      docType: data.docType,
      counterpartyGstin: data.counterpartyGstin,
      counterpartyName: data.counterpartyName,
      counterpartyState: data.counterpartyState,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate,
      placeOfSupply: data.placeOfSupply,
      reverseCharge: data.reverseCharge,
      isExport: data.isExport,
      invoiceValue: data.invoiceValue,
      taxableValue: data.taxableValue,
      igst: data.igst,
      cgst: data.cgst,
      sgst: data.sgst,
      cess: data.cess,
      lines: data.lines ?? [
        {
          hsnSac: undefined,
          taxableValue: data.taxableValue,
          gstRate: data.taxableValue > 0 ? Math.round(((data.igst + data.cgst + data.sgst) / data.taxableValue) * 10000) / 100 : 0,
          igst: data.igst,
          cgst: data.cgst,
          sgst: data.sgst,
          cess: data.cess,
        },
      ],
    },
  });

  await taxAudit({
    organizationId,
    userId,
    action: "CREATE",
    entity: "tax.gst.invoice",
    entityId: invoiceId,
    description: `Manual GST invoice ${data.invoiceNumber}`,
  });

  return NextResponse.json({ id: invoiceId }, { status: 201 });
}, { permission: "tax.write" });
