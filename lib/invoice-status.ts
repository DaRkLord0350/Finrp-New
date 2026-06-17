// ============================================================
// lib/invoice-status.ts
// Single source of truth for invoice status display + ordering.
// Mirrors the Prisma `InvoiceStatus` enum so the UI never drifts.
// ============================================================

export interface InvoiceStatusMeta {
  label: string;
  color: string;
}

// Keyed by the enum value stored in the DB.
export const INVOICE_STATUS_META: Record<string, InvoiceStatusMeta> = {
  DRAFT:     { label: "Draft",     color: "#94a3b8" },
  SENT:      { label: "Sent",      color: "#3b82f6" },
  VIEWED:    { label: "Viewed",    color: "#06b6d4" },
  PARTIAL:   { label: "Partially Paid", color: "#f59e0b" },
  PAID:      { label: "Paid",      color: "#10b981" },
  OVERDUE:   { label: "Overdue",   color: "#ef4444" },
  CANCELLED: { label: "Cancelled", color: "#71717a" },
};

// Display / selection order (matches the product spec ordering).
export const INVOICE_STATUS_ORDER = [
  "DRAFT",
  "SENT",
  "VIEWED",
  "PARTIAL",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;

export type InvoiceStatusValue = (typeof INVOICE_STATUS_ORDER)[number];

export function getInvoiceStatusMeta(status: string): InvoiceStatusMeta {
  return INVOICE_STATUS_META[status] ?? { label: status, color: "#94a3b8" };
}

export function isValidInvoiceStatus(status: string): status is InvoiceStatusValue {
  return (INVOICE_STATUS_ORDER as readonly string[]).includes(status);
}
