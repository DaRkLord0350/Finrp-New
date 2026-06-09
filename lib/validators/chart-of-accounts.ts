// ============================================================
// Chart of Accounts — Zod Validators
// ============================================================

import { z } from "zod";

export const ACCOUNT_TYPES = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "INCOME",
  "EXPENSE",
  "COGS",
  "STOCK",
] as const;

export const AccountTypeEnum = z.enum(ACCOUNT_TYPES);

// Subtype catalogue per top-level type — drives the UI dropdown and
// server-side validation that a chosen subtype belongs to its type.
export const ACCOUNT_SUBTYPES: Record<(typeof ACCOUNT_TYPES)[number], string[]> = {
  ASSET: [
    "Cash",
    "Bank",
    "Accounts Receivable",
    "Other Current Asset",
    "Fixed Asset",
    "Inventory Asset",
    "Prepaid Expense",
    "Tax Receivable",
  ],
  LIABILITY: [
    "Accounts Payable",
    "Credit Card",
    "Tax Payable",
    "Other Current Liability",
    "Long Term Liability",
    "Loan",
  ],
  EQUITY: [
    "Owner Equity",
    "Retained Earnings",
    "Capital Stock",
    "Drawings",
    "Distributions",
  ],
  INCOME: [
    "Sales",
    "General Income",
    "Interest Income",
    "Other Income",
  ],
  EXPENSE: [
    "Rent Expense",
    "Salary Expense",
    "Travel Expense",
    "Telephone Expense",
    "Marketing Expense",
    "Professional Fees",
    "Bank Charges",
    "Other Expense",
  ],
  COGS: [
    "Materials",
    "Labor",
    "Subcontractor",
    "Job Costing",
  ],
  STOCK: [
    "Inventory Asset",
  ],
};

export const ALL_ACCOUNT_SUBTYPES = Object.values(ACCOUNT_SUBTYPES).flat();

const accountCodeSchema = z
  .string()
  .trim()
  .min(1, "Account code is required")
  .max(20, "Account code must be 20 characters or fewer")
  .regex(/^[A-Za-z0-9._-]+$/, "Account code may only contain letters, numbers, dots, hyphens, and underscores");

export const CreateAccountSchema = z.object({
  accountCode: accountCodeSchema,
  accountName: z.string().trim().min(2, "Account name must be at least 2 characters").max(120),
  accountType: AccountTypeEnum,
  accountSubType: z.string().trim().max(60).optional().nullable(),
  parentAccountId: z.string().min(1).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  openingBalance: z.coerce.number().finite().default(0),
}).superRefine((data, ctx) => {
  if (data.accountSubType && !ACCOUNT_SUBTYPES[data.accountType]?.includes(data.accountSubType)) {
    ctx.addIssue({
      code: "custom",
      path: ["accountSubType"],
      message: `"${data.accountSubType}" is not a valid subtype for ${data.accountType}`,
    });
  }
});

// Edits may only touch presentation/organisational fields — never the
// type/subtype of an account that already has postings (enforced in
// the service layer where transaction history is known).
export const UpdateAccountSchema = z.object({
  accountName: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  parentAccountId: z.string().min(1).optional().nullable(),
  isActive: z.boolean().optional(),
  // Only permitted for non-system, transaction-free accounts — the
  // service layer rejects the change otherwise.
  accountType: AccountTypeEnum.optional(),
  accountSubType: z.string().trim().max(60).optional().nullable(),
});

export const ListAccountsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: AccountTypeEnum.optional(),
  subType: z.string().trim().max(60).optional(),
  status: z.enum(["active", "inactive", "all"]).default("active"),
  parentAccountId: z.string().optional(),
  sortBy: z.enum(["name", "code", "balance", "createdAt"]).default("code"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const BulkUpdateAccountsSchema = z.object({
  accountIds: z.array(z.string().min(1)).min(1, "Select at least one account").max(500),
  action: z.enum(["activate", "deactivate"]),
});

export const ExportAccountsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: AccountTypeEnum.optional(),
  status: z.enum(["active", "inactive", "all"]).default("all"),
  format: z.enum(["csv"]).default("csv"),
});

export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;
export type UpdateAccountInput = z.infer<typeof UpdateAccountSchema>;
export type ListAccountsQuery = z.infer<typeof ListAccountsQuerySchema>;
export type BulkUpdateAccountsInput = z.infer<typeof BulkUpdateAccountsSchema>;
export type ExportAccountsQuery = z.infer<typeof ExportAccountsQuerySchema>;
