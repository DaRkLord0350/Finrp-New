// ============================================================
// lib/vault/constants.ts — Customer document vault taxonomy
// ============================================================

import type { DocumentFolder } from "@prisma/client";

export const DOCUMENT_FOLDERS: DocumentFolder[] = [
  "GST",
  "INCOME_TAX",
  "TDS",
  "AUDIT",
  "ROC",
  "PAYROLL",
  "BANK_STATEMENTS",
  "INVOICES",
  "OTHER",
];

export const FOLDER_LABELS: Record<DocumentFolder, string> = {
  GST: "GST",
  INCOME_TAX: "Income Tax",
  TDS: "TDS",
  AUDIT: "Audit",
  ROC: "ROC",
  PAYROLL: "Payroll",
  BANK_STATEMENTS: "Bank Statements",
  INVOICES: "Invoices",
  OTHER: "Other",
};

export const FOLDER_COLORS: Record<DocumentFolder, string> = {
  GST: "#6366f1",
  INCOME_TAX: "#0ea5e9",
  TDS: "#10b981",
  AUDIT: "#f59e0b",
  ROC: "#8b5cf6",
  PAYROLL: "#ec4899",
  BANK_STATEMENTS: "#14b8a6",
  INVOICES: "#f97316",
  OTHER: "#94a3b8",
};

// Largest file we inline-store as a data URL (vault uses the existing
// metadata + fileUrl pattern; larger files require a hosted URL).
export const MAX_INLINE_BYTES = 1_500_000;

export function isValidFolder(v: unknown): v is DocumentFolder {
  return typeof v === "string" && (DOCUMENT_FOLDERS as string[]).includes(v);
}
