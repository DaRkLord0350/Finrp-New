// ============================================================
// FinRP — Shared Zod Validation Schemas
// Used by both API route handlers and frontend forms
// ============================================================

import { z } from "zod";

// ─── Item ────────────────────────────────────────────────────
export const itemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(200),
  description: z.string().max(1000).optional(),
  price: z.number().min(0, "Price must be 0 or more").default(0),
  stock: z.number().int().min(0, "Stock must be 0 or more"),
  lowStockAt: z.number().int().min(1, "Threshold must be at least 1"),
});

export type ItemInput = z.infer<typeof itemSchema>;

// ─── Business ────────────────────────────────────────────────
export const businessSchema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters").max(200),
  type: z.string().min(1, "Please select a business type"),
  industry: z.string().min(1, "Please select an industry"),
  address: z.string().min(5, "Please enter a valid address").max(500),
  country: z.string().min(1, "Please select a country"),
  currency: z.string().min(1, "Please select a currency"),
  taxId: z.string().optional(),
});

export type BusinessInput = z.infer<typeof businessSchema>;

// ─── Transaction ─────────────────────────────────────────────
export const transactionSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  type: z.enum(["SALE", "RESTOCK"]),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  note: z.string().max(500).optional(),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

// ─── Compliance Task ─────────────────────────────────────────
export const complianceTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  category: z.enum(["TAX", "REGULATORY", "LICENSE", "AUDIT", "REPORTING", "OTHER"]).default("OTHER"),
  dueDate: z.string().min(1, "Due date is required"),
});

export type ComplianceTaskInput = z.infer<typeof complianceTaskSchema>;

// ─── Invoice Appearance ──────────────────────────────────────
// All fields optional — the PUT handler upserts a partial update.
const hexColor = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Enter a valid hex color");

export const invoiceAppearanceSchema = z.object({
  template: z.string().min(1).max(60).optional(),
  accentColor: hexColor.optional(),
  fontFamily: z.string().min(1).max(60).optional(),
  borderRadius: z.number().int().min(0).max(40).optional(),
  invoiceTitle: z.string().min(1).max(40).optional(),
  footerText: z.string().max(300).optional(),
  signatureText: z.string().max(120).nullish(),
  signatureImageUrl: z.string().max(2000).nullish(),
  watermarkText: z.string().max(60).nullish(),
  draftWatermark: z.boolean().optional(),
  logoUrl: z.string().max(2000).nullish(),
  showLogo: z.boolean().optional(),
  showQr: z.boolean().optional(),
  showPaymentLink: z.boolean().optional(),
  showDueStamp: z.boolean().optional(),
  showGst: z.boolean().optional(),
  showPan: z.boolean().optional(),
  showItemDescription: z.boolean().optional(),
  showDiscountColumn: z.boolean().optional(),
  showTaxColumn: z.boolean().optional(),
  showShipping: z.boolean().optional(),
  showNotes: z.boolean().optional(),
  showTerms: z.boolean().optional(),
});

export type InvoiceAppearanceInput = z.infer<typeof invoiceAppearanceSchema>;
