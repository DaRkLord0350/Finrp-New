// ============================================================
// lib/generators/invoice-number.ts
// ============================================================

import { prisma } from "@/lib/prisma";

/**
 * Generate the next invoice number for an organization.
 * Format: {prefix}-{YYYY}-{00001}
 * Queries the DB to find the last issued number and increments.
 * Uses a transaction to prevent race conditions.
 *
 * @example await generateNextInvoiceNumber("org_123") → "INV-2026-00042"
 */
export async function generateNextInvoiceNumber(
  organizationId: string,
  prefix?: string
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    // Get org settings for prefix
    const settings = await tx.settings.findUnique({
      where: { organizationId },
      select: { invoicePrefix: true, invoiceStartNumber: true },
    });

    const resolvedPrefix = prefix ?? settings?.invoicePrefix ?? "INV";
    const year = new Date().getFullYear();

    // Find the highest invoice number for this org this year
    const lastInvoice = await tx.invoice.findFirst({
      where: {
        organizationId,
        invoiceNumber: { startsWith: `${resolvedPrefix}-${year}-` },
      },
      orderBy: { invoiceNumber: "desc" },
      select: { invoiceNumber: true },
    });

    let nextSeq = settings?.invoiceStartNumber ?? 1;
    if (lastInvoice) {
      const parts = lastInvoice.invoiceNumber.split("-");
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }

    return `${resolvedPrefix}-${year}-${String(nextSeq).padStart(5, "0")}`;
  });
}

/**
 * Simple stateless invoice number generator (no DB, for previews).
 */
export function generateInvoiceNumber(prefix: string, count: number): string {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(count).padStart(5, "0")}`;
}

/**
 * Generate a purchase order number.
 */
export function generatePONumber(prefix = "PO", count: number): string {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(count).padStart(4, "0")}`;
}
