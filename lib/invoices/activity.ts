// ============================================================
// lib/invoices/activity.ts
// Invoice activity / audit timeline. Fire-and-forget: logging must
// NEVER break the host request, so every write is wrapped in try/catch.
// ============================================================

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type InvoiceActivityType =
  | "CREATED"
  | "STATUS_CHANGED"
  | "UPDATED"
  | "PDF_GENERATED"
  | "PAYMENT_RECORDED"
  | "EMAIL_SENT"
  | "SHARED"
  | "VIEWED"
  | "CREDIT_NOTE"
  | "RECURRING"
  | "DELETED";

interface LogInvoiceActivityArgs {
  invoiceId: string;
  organizationId: string;
  type: InvoiceActivityType;
  message: string;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
  actorName?: string | null;
}

/**
 * Append an activity entry for an invoice. Returns the created row, or null
 * if the write failed (the caller's primary work is never interrupted).
 */
export async function logInvoiceActivity(args: LogInvoiceActivityArgs) {
  try {
    return await prisma.invoiceActivity.create({
      data: {
        invoiceId: args.invoiceId,
        organizationId: args.organizationId,
        type: args.type,
        message: args.message,
        metadata: args.metadata ? (args.metadata as Prisma.InputJsonValue) : undefined,
        actorId: args.actorId ?? undefined,
        actorName: args.actorName ?? undefined,
      },
    });
  } catch (err) {
    console.error("[logInvoiceActivity]", err);
    return null;
  }
}

/**
 * List activity entries for an invoice, newest first. Tenant-scoped.
 */
export async function listInvoiceActivity(invoiceId: string, organizationId: string) {
  return prisma.invoiceActivity.findMany({
    where: { invoiceId, organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
