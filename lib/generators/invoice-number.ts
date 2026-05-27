// ============================================================
// lib/generators/invoice-number.ts
// Collision-safe, organization-scoped invoice number generation.
// Uses PostgreSQL ON CONFLICT DO UPDATE for atomic increment.
// Format: {prefix}-{YYYY}-{000001}
// ============================================================

import { prisma } from "@/lib/prisma";

/**
 * Atomically generate the next invoice number for an organization.
 * Uses a dedicated counter table with atomic SQL upsert to prevent
 * race conditions under concurrent requests.
 *
 * @example await generateNextInvoiceNumber("org_123") → "INV-2026-000001"
 */
export async function generateNextInvoiceNumber(
  organizationId: string,
  prefix?: string
): Promise<string> {
  const settings = await prisma.settings.findUnique({
    where: { organizationId },
    select: { invoicePrefix: true },
  });

  const resolvedPrefix = prefix ?? settings?.invoicePrefix ?? "INV";
  const year = new Date().getFullYear();
  const id = crypto.randomUUID();

  // Atomic upsert: INSERT ... ON CONFLICT DO UPDATE SET lastNumber = lastNumber + 1
  // This is a single SQL operation and is safe under concurrent requests.
  const result = await prisma.$queryRaw<Array<{ lastNumber: number }>>`
    INSERT INTO "invoice_counters" ("id", "organizationId", "year", "lastNumber")
    VALUES (${id}, ${organizationId}, ${year}, 1)
    ON CONFLICT ("organizationId", "year")
    DO UPDATE SET "lastNumber" = "invoice_counters"."lastNumber" + 1
    RETURNING "lastNumber"
  `;

  const nextNumber = Number(result[0]?.lastNumber ?? 1);
  return `${resolvedPrefix}-${year}-${String(nextNumber).padStart(6, "0")}`;
}

/**
 * Stateless preview number (no DB — for UI display only).
 */
export function generateInvoiceNumber(prefix: string, count: number): string {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(count).padStart(6, "0")}`;
}

/**
 * Generate a purchase order number.
 */
export function generatePONumber(prefix = "PO", count: number): string {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(count).padStart(4, "0")}`;
}
