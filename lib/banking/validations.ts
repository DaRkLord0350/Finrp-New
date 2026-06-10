// ============================================================
// FinRP Banking OS — Zod Validation Schemas
// ============================================================

import { z } from "zod";

export const createBankAccountSchema = z.object({
  accountName: z.string().min(1).max(100),
  bankName: z.string().min(1).max(100),
  accountNumber: z.string().min(5).max(30),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code").optional(),
  swiftCode: z.string().max(11).optional(),
  accountType: z.enum([
    "SAVINGS", "CURRENT", "CASH_CREDIT", "OVERDRAFT",
    "FIXED_DEPOSIT", "RECURRING_DEPOSIT", "NRE", "NRO", "FOREX", "WALLET",
  ]).default("CURRENT"),
  currency: z.string().length(3).default("INR"),
  openingBalance: z.number().default(0),
  isPrimary: z.boolean().default(false),
  branchName: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export const createTransactionSchema = z.object({
  bankAccountId: z.string().cuid(),
  transactionDate: z.string().datetime().or(z.date()),
  valueDate: z.string().datetime().or(z.date()).optional(),
  narration: z.string().min(1).max(500),
  credit: z.number().positive().optional(),
  debit: z.number().positive().optional(),
  balance: z.number().optional(),
  referenceNumber: z.string().max(100).optional(),
  chequeNumber: z.string().max(20).optional(),
  txnType: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().max(1000).optional(),
}).refine(d => d.credit !== undefined || d.debit !== undefined, {
  message: "Either credit or debit amount is required",
});

export const updateTransactionSchema = z.object({
  category: z.string().optional(),
  subCategory: z.string().optional(),
  txnType: z.string().optional(),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["UNREVIEWED", "REVIEWED", "CATEGORIZED", "MATCHED", "EXCLUDED"]).optional(),
  isIgnored: z.boolean().optional(),
  isFlagged: z.boolean().optional(),
  gstCategory: z.string().optional(),
  gstin: z.string().optional(),
  invoiceRef: z.string().optional(),
});

export const bulkCategorizeSchema = z.object({
  transactionIds: z.array(z.string().cuid()).min(1).max(200),
  category: z.string().min(1),
  subCategory: z.string().optional(),
  txnType: z.string().optional(),
});

export const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  priority: z.number().int().min(1).max(1000).default(100),
  isActive: z.boolean().default(true),
  conditions: z.array(z.object({
    field: z.enum(["narration", "amount", "credit", "debit", "referenceNumber", "txnType"]),
    operator: z.enum(["contains", "starts_with", "ends_with", "equals", "gt", "lt", "gte", "lte", "regex"]),
    value: z.union([z.string(), z.number()]),
    logic: z.enum(["AND", "OR"]).optional(),
  })).min(1),
  actions: z.array(z.object({
    type: z.enum(["set_category", "set_subcategory", "set_txn_type", "flag", "add_tag", "set_gst_category"]),
    value: z.string().min(1),
  })).min(1),
});

export const createReconcileSessionSchema = z.object({
  bankAccountId: z.string().cuid(),
  name: z.string().max(100).optional(),
  startDate: z.string().datetime().or(z.date()),
  endDate: z.string().datetime().or(z.date()),
  openingBalance: z.number().optional(),
  closingBalance: z.number().optional(),
});

export const manualMatchSchema = z.object({
  bankTransactionId: z.string().cuid(),
  entityType: z.enum(["INVOICE", "PAYMENT", "EXPENSE"]),
  entityId: z.string().cuid(),
  entityRef: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export const setuConsentSchema = z.object({
  bankAccountId: z.string().cuid().optional(),
  redirectUrl: z.string().url().optional(),
  dateRange: z.object({
    from: z.string(),
    to: z.string(),
  }).optional(),
  fiTypes: z.array(z.string()).optional(),
  consentTypes: z.array(z.string()).optional(),
});

export const plaidExchangeSchema = z.object({
  publicToken: z.string().min(1),
  bankAccountId: z.string().cuid().optional(),
  institutionId: z.string().optional(),
  institutionName: z.string().optional(),
  accountIds: z.array(z.string()).optional(),
});

export const importStatementSchema = z.object({
  bankAccountId: z.string().cuid().optional(),
  fileType: z.enum(["CSV", "EXCEL", "PDF", "OFX", "MT940"]),
  fileUrl: z.string().url(),
  fileName: z.string(),
  fileSize: z.number().int().positive().optional(),
  columnMapping: z.record(z.string(), z.string()).optional(),
});

export const syncAccountSchema = z.object({
  bankAccountId: z.string().cuid(),
  force: z.boolean().default(false),
});

export const transferSchema = z.object({
  fromAccountId: z.string().cuid(),
  toAccountId: z.string().cuid(),
  amount: z.number().positive(),
  transferDate: z.string().datetime().or(z.date()),
  notes: z.string().max(500).optional(),
  referenceNumber: z.string().max(100).optional(),
});
