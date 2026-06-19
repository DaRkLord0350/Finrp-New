// ============================================================
// lib/invoices/payment-terms.ts
// Payment-term presets + due-date derivation. Pure & isomorphic
// (used by the creation form and the recurring-invoice worker).
// ============================================================

export interface PaymentTerm {
  value: string;
  label: string;
  days: number | null; // null = custom (user picks the due date)
}

export const PAYMENT_TERMS: PaymentTerm[] = [
  { value: "DUE_ON_RECEIPT", label: "Due on Receipt", days: 0 },
  { value: "NET_15", label: "Net 15", days: 15 },
  { value: "NET_30", label: "Net 30", days: 30 },
  { value: "NET_45", label: "Net 45", days: 45 },
  { value: "NET_60", label: "Net 60", days: 60 },
  { value: "CUSTOM", label: "Custom", days: null },
];

export function paymentTermsToDays(term?: string | null): number | null {
  const t = PAYMENT_TERMS.find((p) => p.value === term);
  return t ? t.days : null;
}

/** Returns the derived due date, or null when the term is custom/unknown. */
export function dueDateFromTerms(issueDate: Date, term?: string | null): Date | null {
  const days = paymentTermsToDays(term);
  if (days === null) return null;
  const d = new Date(issueDate);
  d.setDate(d.getDate() + days);
  return d;
}
