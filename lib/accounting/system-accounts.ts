// ============================================================
// System-generated Chart of Accounts seed set
//
// Every new organization gets these accounts automatically —
// they are the minimum viable COA that JournalEntry, Invoice,
// Purchase, Loan, and Expense postings rely on. They:
//   - cannot be deleted
//   - cannot change `type`
//   - cannot break references
// (enforced in lib/services/accountingService.ts + the API layer)
// ============================================================

import type { Prisma, PrismaClient, AccountType } from "@prisma/client";

export type SystemAccountSeed = {
  code: string;
  name: string;
  type: AccountType;
  accountSubType: string;
  description: string;
};

export const SYSTEM_ACCOUNTS: SystemAccountSeed[] = [
  { code: "1000", name: "Cash",                  type: "CASH",      accountSubType: "Cash on Hand",          description: "Cash on hand" },
  { code: "1010", name: "Bank",                  type: "BANK",      accountSubType: "Current Account",       description: "Primary operating bank account" },
  { code: "1100", name: "Accounts Receivable",   type: "ASSET",     accountSubType: "Accounts Receivable",   description: "Amounts owed to the business by customers" },
  { code: "1200", name: "Inventory Asset",       type: "ASSET",     accountSubType: "Inventory Asset",       description: "Value of goods held for sale" },
  { code: "1310", name: "TDS Receivable",        type: "ASSET",     accountSubType: "Tax Receivable",        description: "TDS withheld by customers, claimable against tax liability" },
  { code: "2000", name: "Accounts Payable",      type: "LIABILITY", accountSubType: "Accounts Payable",      description: "Amounts the business owes to vendors" },
  { code: "2100", name: "Tax Payable",           type: "TAX",       accountSubType: "Tax Payable",           description: "GST/TDS and other tax liabilities owed" },
  { code: "2110", name: "TCS Payable",           type: "TAX",       accountSubType: "Tax Payable",           description: "TCS collected from customers, payable to the tax authority" },
  { code: "3000", name: "Owner Equity",          type: "EQUITY",    accountSubType: "Owner Equity",          description: "Owner's stake in the business" },
  { code: "3100", name: "Retained Earnings",     type: "EQUITY",    accountSubType: "Retained Earnings",     description: "Accumulated profits retained in the business" },
  { code: "4000", name: "Sales",                 type: "INCOME",    accountSubType: "Sales",                 description: "Revenue from sale of goods and services" },
  { code: "4900", name: "Foreign Exchange Gain/Loss", type: "INCOME", accountSubType: "Other Income",       description: "Unrealized/realized currency revaluation gains and losses" },
  { code: "5000", name: "Cost of Goods Sold",    type: "COGS",      accountSubType: "Materials",             description: "Direct cost of goods and services sold" },
  { code: "5950", name: "Rounding Off",          type: "EXPENSE",   accountSubType: "Other Expense",         description: "Rounding differences on postings" },
];

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Idempotent — skips orgs that already have system accounts.
 * Call inside the same transaction that creates the Organization
 * so a half-provisioned org never exists.
 */
export async function seedSystemAccounts(
  tx: Tx,
  organizationId: string,
  userId?: string | null
): Promise<number> {
  const existing = await tx.account.count({
    where: { organizationId, isSystemGenerated: true },
  });
  if (existing > 0) return 0;

  await tx.account.createMany({
    data: SYSTEM_ACCOUNTS.map((acc) => ({
      organizationId,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      accountSubType: acc.accountSubType,
      description: acc.description,
      balance: 0,
      openingBalance: 0,
      isActive: true,
      isSystemGenerated: true,
      createdBy: userId ?? null,
    })),
    skipDuplicates: true,
  });

  return SYSTEM_ACCOUNTS.length;
}
