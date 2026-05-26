// ============================================================
// lib/pdf/generateInvoicePdf.ts
// Server-side PDF generation and file storage.
// Call from API route handlers only (Node.js runtime).
// ============================================================

import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import React from "react";
import { prisma } from "@/lib/prisma";
import { InvoicePDF } from "@/components/pdf/InvoicePDF";
import type { InvoicePDFData } from "@/components/pdf/InvoicePDF";

/**
 * Generate a PDF for an invoice, save it to /public/invoices/,
 * update the invoice record with pdfUrl, and return the public URL.
 */
export async function generateInvoicePdf(
  invoiceId: string,
  organizationId: string
): Promise<{ pdfUrl: string; pdfFileName: string }> {
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

  const pdfData: InvoicePDFData = {
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    status: invoice.status,
    notes: invoice.notes,
    currency: invoice.currency,
    subtotal: Number(invoice.subtotal),
    discount: Number(invoice.discount),
    shipping: Number(invoice.shipping),
    taxRate: Number(invoice.taxRate),
    taxAmount: Number(invoice.taxAmount),
    total: Number(invoice.total),
    paidAmount: Number(invoice.paidAmount),
    balanceDue: Number(invoice.balanceDue),
    items: invoice.items.map((item) => ({
      description: item.description,
      sku: item.sku,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
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
      taxId: profile?.taxId,
      contactEmail: profile?.contactEmail,
      contactPhone: profile?.contactPhone,
      website: profile?.website,
      logoUrl: profile?.logoUrl,
    },
  };

  // Generate PDF buffer
  // Cast needed: renderToBuffer expects DocumentProps root, but we wrap in
  // our InvoicePDF component which internally renders a <Document>.
  const pdfBuffer = await renderToBuffer(
    React.createElement(InvoicePDF, { data: pdfData }) as React.ReactElement<DocumentProps>
  );

  // Save to /public/invoices/
  const invoicesDir = path.join(process.cwd(), "public", "invoices");
  await mkdir(invoicesDir, { recursive: true });

  const pdfFileName = `${invoice.invoiceNumber.replace(/[^a-zA-Z0-9-]/g, "_")}-${invoiceId.slice(0, 8)}.pdf`;
  const pdfPath = path.join(invoicesDir, pdfFileName);
  await writeFile(pdfPath, pdfBuffer);

  const pdfUrl = `/invoices/${pdfFileName}`;

  // Update invoice record with generated PDF details.
  const generatedAt = new Date();
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { pdfUrl, pdfFileName, pdfGeneratedAt: generatedAt },
  });

  return { pdfUrl, pdfFileName };
}
