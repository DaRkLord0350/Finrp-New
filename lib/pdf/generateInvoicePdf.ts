// ============================================================
// lib/pdf/generateInvoicePdf.ts
// Server-side, in-memory PDF generation.
//
// IMPORTANT: PDFs are NEVER written to disk. Serverless/edge file
// systems (e.g. Vercel's /var/task) are read-only, so every renderer
// here returns an in-memory Buffer. API routes stream that buffer
// straight to the client (see app/api/invoices/[id]/pdf/route.ts).
// If durable storage is ever needed, upload the buffer to object
// storage (S3 / R2 / Supabase Storage / Vercel Blob) — never the
// local filesystem.
//
// Call from API route handlers only (Node.js runtime).
// ============================================================

import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import React from "react";
import { prisma } from "@/lib/prisma";
import { InvoicePDF } from "@/components/pdf/InvoicePDF";
import type { InvoicePDFData } from "@/components/pdf/InvoicePDF";
import { getInvoiceAppearance } from "@/lib/invoices/appearance";

/** Build a safe, human-friendly download filename from a document number. */
export function pdfFileNameFor(documentNumber: string): string {
  const safe = documentNumber.replace(/[^a-zA-Z0-9-_]/g, "_") || "document";
  return `${safe}.pdf`;
}

/**
 * Render an invoice to a PDF buffer (no disk write, no DB update).
 * Used for direct download/print streaming and email attachments.
 */
export async function renderInvoicePdfBuffer(
  invoiceId: string,
  organizationId: string
): Promise<{ buffer: Buffer; pdfFileName: string; invoiceNumber: string }> {
  // Fetch full invoice data
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId },
    include: {
      customer: true,
      items: true,
      payments: true,
    },
  });

  if (!invoice) throw new Error("Invoice not found");

  // Fetch business profile
  const profile = await prisma.businessProfile.findUnique({
    where: { organizationId },
  });

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });

  // Branding / appearance (falls back to sensible defaults when unset).
  const appearance = await getInvoiceAppearance(organizationId);

  const pdfData: InvoicePDFData = {
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    status: invoice.status,
    notes: invoice.notes,
    terms: invoice.terms,
    currency: invoice.currency,
    subtotal: Number(invoice.subtotal),
    discount: Number(invoice.discount),
    shipping: Number(invoice.shipping),
    taxRate: Number(invoice.taxRate),
    taxAmount: Number(invoice.taxAmount),
    total: Number(invoice.total),
    paidAmount: Number(invoice.paidAmount),
    balanceDue: Number(invoice.balanceDue),
    customFields: Array.isArray(invoice.customFields)
      ? (invoice.customFields as Array<{ label: string; value: string }>)
      : null,
    items: invoice.items.map((item) => ({
      description: item.description,
      sku: item.sku,
      hsnSac: item.hsnSac,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount),
      taxPercent: Number(item.taxPercent),
      amount: Number(item.amount),
    })),
    customer: {
      name: invoice.customer.name,
      email: invoice.customer.email,
      phone: invoice.customer.phone,
      company: invoice.customer.company,
      address: invoice.customer.address,
      gstin: invoice.customer.gstin,
    },
    business: {
      name: profile?.businessName ?? org?.name ?? "My Company",
      address: profile?.address,
      city: profile?.city,
      state: profile?.state,
      country: profile?.country,
      gstin: profile?.gstin ?? profile?.taxId ?? null,
      pan: profile?.pan ?? null,
      contactEmail: profile?.contactEmail,
      contactPhone: profile?.contactPhone,
      website: profile?.website,
      logoUrl: appearance.logoUrl ?? profile?.logoUrl,
    },
  };

  // Generate PDF buffer
  // Cast needed: renderToBuffer expects DocumentProps root, but we wrap in
  // our InvoicePDF component which internally renders a <Document>.
  const pdfBuffer = await renderToBuffer(
    React.createElement(InvoicePDF, { data: pdfData, appearance }) as React.ReactElement<DocumentProps>
  );

  return {
    buffer: pdfBuffer as Buffer,
    pdfFileName: pdfFileNameFor(invoice.invoiceNumber),
    invoiceNumber: invoice.invoiceNumber,
  };
}

interface SnapshotItem {
  description: string;
  sku?: string | null;
  hsnSac?: string | null;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  amount: number;
}

/**
 * Render a credit note to a PDF buffer (no disk write), reusing the invoice
 * renderer with a "CREDIT NOTE" title.
 */
export async function renderCreditNotePdfBuffer(
  creditNoteId: string,
  organizationId: string
): Promise<{ buffer: Buffer; pdfFileName: string; creditNoteNumber: string }> {
  const cn = await prisma.creditNote.findFirst({
    where: { id: creditNoteId, organizationId },
    include: { customer: true },
  });
  if (!cn) throw new Error("Credit note not found");

  const [profile, org, appearance] = await Promise.all([
    prisma.businessProfile.findUnique({ where: { organizationId } }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    getInvoiceAppearance(organizationId),
  ]);

  const items: SnapshotItem[] = Array.isArray(cn.items) ? (cn.items as unknown as SnapshotItem[]) : [];
  const subtotal = Number(cn.subtotal);
  const taxAmount = Number(cn.taxAmount);
  const effectiveTaxRate = subtotal > 0 ? (taxAmount / subtotal) * 100 : 0;

  const pdfData: InvoicePDFData = {
    invoiceNumber: cn.creditNoteNumber,
    issueDate: cn.issueDate,
    dueDate: cn.issueDate,
    status: "ISSUED",
    notes: cn.notes,
    terms: null,
    currency: cn.currency,
    subtotal,
    discount: 0,
    shipping: 0,
    taxRate: effectiveTaxRate,
    taxAmount,
    total: Number(cn.total),
    paidAmount: 0,
    balanceDue: 0,
    customFields: cn.reason ? [{ label: "Reason", value: cn.reason }] : null,
    items: items.map((it) => ({
      description: it.description,
      sku: it.sku ?? null,
      hsnSac: it.hsnSac ?? null,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      taxPercent: Number(it.taxPercent),
      amount: Number(it.amount),
    })),
    customer: {
      name: cn.customer.name,
      email: cn.customer.email,
      phone: cn.customer.phone,
      company: cn.customer.company,
      address: cn.customer.address,
      gstin: cn.customer.gstin,
    },
    business: {
      name: profile?.businessName ?? org?.name ?? "My Company",
      address: profile?.address,
      city: profile?.city,
      state: profile?.state,
      country: profile?.country,
      gstin: profile?.gstin ?? profile?.taxId ?? null,
      pan: profile?.pan ?? null,
      contactEmail: profile?.contactEmail,
      contactPhone: profile?.contactPhone,
      website: profile?.website,
      logoUrl: appearance.logoUrl ?? profile?.logoUrl,
    },
  };

  const cnAppearance = { ...appearance, invoiceTitle: "CREDIT NOTE", draftWatermark: false, showDueStamp: false };

  const pdfBuffer = await renderToBuffer(
    React.createElement(InvoicePDF, { data: pdfData, appearance: cnAppearance }) as React.ReactElement<DocumentProps>
  );

  return {
    buffer: pdfBuffer as Buffer,
    pdfFileName: pdfFileNameFor(cn.creditNoteNumber),
    creditNoteNumber: cn.creditNoteNumber,
  };
}
