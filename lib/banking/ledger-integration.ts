// ============================================================
// FinRP Banking OS — Ledger Integration
// Every banking action creates double-entry journal entries.
// Uses the existing JournalEntry + JournalLine + Account models.
// Accounts are looked up by code; missing accounts are auto-created.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { AccountType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Find or create a ledger account by code within an organization
// ---------------------------------------------------------------------------
async function resolveAccount(
  organizationId: string,
  code: string,
  name: string,
  type: AccountType
): Promise<string> {
  const account = await prisma.account.upsert({
    where: { organizationId_code: { organizationId, code } },
    create: {
      organizationId,
      code,
      name,
      type,
      isActive: true,
      isSystemGenerated: true,
    },
    update: {},
    select: { id: true },
  });
  return account.id;
}

// ---------------------------------------------------------------------------
// Create journal entry for a bank credit (money received)
// Dr: Bank Account   Cr: Accounts Receivable
// ---------------------------------------------------------------------------
export async function createCreditJournalEntry(
  organizationId: string,
  bankAccountId: string,
  amount: number,
  narration: string,
  transactionDate: Date,
  entityType?: string,
  entityId?: string
): Promise<void> {
  try {
    const bankAccount = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
      select: { accountName: true },
    });
    if (!bankAccount) return;

    const [bankAccId, arAccId] = await Promise.all([
      resolveAccount(organizationId, "1010", bankAccount.accountName, "ASSET" as AccountType),
      resolveAccount(organizationId, "1200", "Accounts Receivable", "ASSET" as AccountType),
    ]);

    await prisma.journalEntry.create({
      data: {
        organizationId,
        entryDate: transactionDate,
        reference: `BANK-CR-${Date.now()}`,
        description: narration.slice(0, 255),
        totalDebit: amount,
        totalCredit: amount,
        lines: {
          create: [
            { accountId: bankAccId, type: "DEBIT", amount, description: narration.slice(0, 255) },
            { accountId: arAccId, type: "CREDIT", amount, description: narration.slice(0, 255) },
          ],
        },
      },
    });
  } catch (err) {
    console.error("[ledger] createCreditJournalEntry failed:", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Create journal entry for a bank debit (money paid)
// Dr: Expense Account   Cr: Bank Account
// ---------------------------------------------------------------------------
export async function createDebitJournalEntry(
  organizationId: string,
  bankAccountId: string,
  amount: number,
  narration: string,
  transactionDate: Date,
  category?: string,
  _entityType?: string,
  _entityId?: string
): Promise<void> {
  try {
    const bankAccount = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
      select: { accountName: true },
    });
    if (!bankAccount) return;

    const expenseInfo = resolveExpenseAccount(category);

    const [expAccId, bankAccId] = await Promise.all([
      resolveAccount(organizationId, expenseInfo.code, expenseInfo.name, expenseInfo.type as AccountType),
      resolveAccount(organizationId, "1010", bankAccount.accountName, "ASSET" as AccountType),
    ]);

    await prisma.journalEntry.create({
      data: {
        organizationId,
        entryDate: transactionDate,
        reference: `BANK-DR-${Date.now()}`,
        description: narration.slice(0, 255),
        totalDebit: amount,
        totalCredit: amount,
        lines: {
          create: [
            { accountId: expAccId, type: "DEBIT", amount, description: narration.slice(0, 255) },
            { accountId: bankAccId, type: "CREDIT", amount, description: narration.slice(0, 255) },
          ],
        },
      },
    });
  } catch (err) {
    console.error("[ledger] createDebitJournalEntry failed:", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Internal transfer: Bank A → Bank B
// Dr: Target Account   Cr: Source Account
// ---------------------------------------------------------------------------
export async function createTransferJournalEntry(
  organizationId: string,
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  narration: string,
  transferDate: Date
): Promise<void> {
  try {
    const [fromAccount, toAccount] = await Promise.all([
      prisma.bankAccount.findUnique({ where: { id: fromAccountId }, select: { accountName: true } }),
      prisma.bankAccount.findUnique({ where: { id: toAccountId }, select: { accountName: true } }),
    ]);
    if (!fromAccount || !toAccount) return;

    // Use unique codes to avoid collision between bank accounts
    const fromCode = `BA-${fromAccountId.slice(-8)}`;
    const toCode = `BA-${toAccountId.slice(-8)}`;

    const [fromAccId, toAccId] = await Promise.all([
      resolveAccount(organizationId, fromCode, fromAccount.accountName, "ASSET" as AccountType),
      resolveAccount(organizationId, toCode, toAccount.accountName, "ASSET" as AccountType),
    ]);

    await prisma.journalEntry.create({
      data: {
        organizationId,
        entryDate: transferDate,
        reference: `BANK-TRF-${Date.now()}`,
        description: narration.slice(0, 255),
        totalDebit: amount,
        totalCredit: amount,
        lines: {
          create: [
            { accountId: toAccId, type: "DEBIT", amount, description: `Transfer from ${fromAccount.accountName}` },
            { accountId: fromAccId, type: "CREDIT", amount, description: `Transfer to ${toAccount.accountName}` },
          ],
        },
      },
    });
  } catch (err) {
    console.error("[ledger] createTransferJournalEntry failed:", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Recompute and update bank account balance from all transactions
// ---------------------------------------------------------------------------
export async function updateAccountBalance(
  bankAccountId: string,
  organizationId: string
): Promise<void> {
  try {
    const [account, agg] = await Promise.all([
      prisma.bankAccount.findUnique({
        where: { id: bankAccountId },
        select: { openingBalance: true },
      }),
      prisma.bankTransaction.aggregate({
        where: { bankAccountId, organizationId, isIgnored: false, isDuplicate: false },
        _sum: { credit: true, debit: true },
      }),
    ]);
    if (!account) return;

    const totalCredit = Number(agg._sum.credit ?? 0);
    const totalDebit = Number(agg._sum.debit ?? 0);
    const computed = Number(account.openingBalance) + totalCredit - totalDebit;

    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: { currentBalance: computed, availableBalance: computed },
    });
  } catch (err) {
    console.error("[ledger] updateAccountBalance failed:", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Map category → chart of accounts
// ---------------------------------------------------------------------------
function resolveExpenseAccount(category?: string | null): {
  code: string;
  name: string;
  type: string;
} {
  const map: Record<string, { code: string; name: string; type: string }> = {
    "Salary":          { code: "5100", name: "Salaries & Wages",    type: "EXPENSE" },
    "Vendor Payment":  { code: "2000", name: "Accounts Payable",    type: "LIABILITY" },
    "GST Payment":     { code: "2300", name: "GST Payable",          type: "LIABILITY" },
    "TDS Payment":     { code: "2310", name: "TDS Payable",          type: "LIABILITY" },
    "Loan EMI":        { code: "2500", name: "Loan Repayment",       type: "LIABILITY" },
    "Bank Charges":    { code: "5900", name: "Bank Charges",         type: "EXPENSE" },
    "Refund":          { code: "1200", name: "Accounts Receivable",  type: "ASSET" },
    "Internal Transfer": { code: "1010", name: "Bank Transfer",      type: "ASSET" },
  };
  return map[category ?? ""] ?? { code: "5000", name: "General Expenses", type: "EXPENSE" };
}
