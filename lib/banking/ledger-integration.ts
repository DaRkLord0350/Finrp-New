// ============================================================
// FinRP Banking OS — Ledger Integration
// Every banking action creates double-entry journal entries.
// Uses the existing JournalEntry + JournalLine + Account models.
// Accounts are looked up by code; missing accounts are auto-created.
//
// Integrity guarantees:
//  - Posting is idempotent: a given source action maps to a stable
//    `reference`; if a JournalEntry with that reference already exists
//    for the org, we do not post a duplicate.
//  - Posting never fails silently: errors propagate to the caller so a
//    failed ledger write cannot be mistaken for success. Pass a
//    transaction client to make the posting atomic with the source rows.
//  - All money math uses Prisma.Decimal (never JS floating point).
// ============================================================

import { Prisma, type AccountType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recomputeAccountBalances } from "@/lib/accounting/balances";

type LedgerClient = Prisma.TransactionClient | typeof prisma;

const ZERO = new Prisma.Decimal(0);

// ---------------------------------------------------------------------------
// Find or create a ledger account by code within an organization
// ---------------------------------------------------------------------------
async function resolveAccount(
  client: LedgerClient,
  organizationId: string,
  code: string,
  name: string,
  type: AccountType
): Promise<string> {
  const account = await client.account.upsert({
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
// Idempotency guard — true when a posting with this reference already exists
// ---------------------------------------------------------------------------
async function alreadyPosted(
  client: LedgerClient,
  organizationId: string,
  reference: string
): Promise<boolean> {
  const existing = await client.journalEntry.findFirst({
    where: { organizationId, reference, deletedAt: null },
    select: { id: true },
  });
  return existing !== null;
}

// ---------------------------------------------------------------------------
// Create journal entry for a bank credit (money received)
// Dr: Bank Account   Cr: Accounts Receivable
// ---------------------------------------------------------------------------
export async function createCreditJournalEntry(
  organizationId: string,
  bankAccountId: string,
  amount: Prisma.Decimal.Value,
  narration: string,
  transactionDate: Date,
  opts: { reference?: string; entityType?: string; entityId?: string; client?: LedgerClient } = {}
): Promise<void> {
  const client = opts.client ?? prisma;
  const value = new Prisma.Decimal(amount);

  const bankAccount = await client.bankAccount.findFirst({
    where: { id: bankAccountId, organizationId },
    select: { accountName: true },
  });
  if (!bankAccount) throw new Error(`Bank account ${bankAccountId} not found in organization`);

  const reference =
    opts.reference ??
    (opts.entityId ? `BANK-CR-${opts.entityType ?? "TXN"}-${opts.entityId}` : `BANK-CR-${bankAccountId}-${transactionDate.getTime()}`);

  if (await alreadyPosted(client, organizationId, reference)) return;

  const [bankAccId, arAccId] = await Promise.all([
    resolveAccount(client, organizationId, "1010", bankAccount.accountName, "ASSET" as AccountType),
    resolveAccount(client, organizationId, "1200", "Accounts Receivable", "ASSET" as AccountType),
  ]);

  await client.journalEntry.create({
    data: {
      organizationId,
      status: "POSTED",
      journalType: "SYSTEM",
      source: opts.entityType ?? "BANK",
      sourceId: opts.entityId ?? null,
      postedAt: transactionDate,
      entryDate: transactionDate,
      reference,
      description: narration.slice(0, 255),
      totalDebit: value,
      totalCredit: value,
      lines: {
        create: [
          { accountId: bankAccId, type: "DEBIT", amount: value, description: narration.slice(0, 255) },
          { accountId: arAccId, type: "CREDIT", amount: value, description: narration.slice(0, 255) },
        ],
      },
    },
  });

  await recomputeAccountBalances(client, organizationId, [bankAccId, arAccId]);
}

// ---------------------------------------------------------------------------
// Create journal entry for a bank debit (money paid)
// Dr: Expense Account   Cr: Bank Account
// ---------------------------------------------------------------------------
export async function createDebitJournalEntry(
  organizationId: string,
  bankAccountId: string,
  amount: Prisma.Decimal.Value,
  narration: string,
  transactionDate: Date,
  opts: { category?: string; reference?: string; entityType?: string; entityId?: string; client?: LedgerClient } = {}
): Promise<void> {
  const client = opts.client ?? prisma;
  const value = new Prisma.Decimal(amount);

  const bankAccount = await client.bankAccount.findFirst({
    where: { id: bankAccountId, organizationId },
    select: { accountName: true },
  });
  if (!bankAccount) throw new Error(`Bank account ${bankAccountId} not found in organization`);

  const reference =
    opts.reference ??
    (opts.entityId ? `BANK-DR-${opts.entityType ?? "TXN"}-${opts.entityId}` : `BANK-DR-${bankAccountId}-${transactionDate.getTime()}`);

  if (await alreadyPosted(client, organizationId, reference)) return;

  const expenseInfo = resolveExpenseAccount(opts.category);

  const [expAccId, bankAccId] = await Promise.all([
    resolveAccount(client, organizationId, expenseInfo.code, expenseInfo.name, expenseInfo.type as AccountType),
    resolveAccount(client, organizationId, "1010", bankAccount.accountName, "ASSET" as AccountType),
  ]);

  await client.journalEntry.create({
    data: {
      organizationId,
      status: "POSTED",
      journalType: "SYSTEM",
      source: opts.entityType ?? "BANK",
      sourceId: opts.entityId ?? null,
      postedAt: transactionDate,
      entryDate: transactionDate,
      reference,
      description: narration.slice(0, 255),
      totalDebit: value,
      totalCredit: value,
      lines: {
        create: [
          { accountId: expAccId, type: "DEBIT", amount: value, description: narration.slice(0, 255) },
          { accountId: bankAccId, type: "CREDIT", amount: value, description: narration.slice(0, 255) },
        ],
      },
    },
  });

  await recomputeAccountBalances(client, organizationId, [expAccId, bankAccId]);
}

// ---------------------------------------------------------------------------
// Internal transfer: Bank A → Bank B
// Dr: Target Account   Cr: Source Account
// ---------------------------------------------------------------------------
export async function createTransferJournalEntry(
  organizationId: string,
  fromAccountId: string,
  toAccountId: string,
  amount: Prisma.Decimal.Value,
  narration: string,
  transferDate: Date,
  opts: { reference?: string; client?: LedgerClient } = {}
): Promise<void> {
  const client = opts.client ?? prisma;
  const value = new Prisma.Decimal(amount);

  const [fromAccount, toAccount] = await Promise.all([
    client.bankAccount.findFirst({ where: { id: fromAccountId, organizationId }, select: { accountName: true } }),
    client.bankAccount.findFirst({ where: { id: toAccountId, organizationId }, select: { accountName: true } }),
  ]);
  if (!fromAccount) throw new Error(`Source bank account ${fromAccountId} not found in organization`);
  if (!toAccount) throw new Error(`Destination bank account ${toAccountId} not found in organization`);

  // Stable, caller-supplied reference makes the posting idempotent.
  const reference = opts.reference ?? `BANK-TRF-${fromAccountId}-${toAccountId}-${transferDate.getTime()}`;
  if (await alreadyPosted(client, organizationId, reference)) return;

  // Use unique codes to avoid collision between bank accounts
  const fromCode = `BA-${fromAccountId.slice(-8)}`;
  const toCode = `BA-${toAccountId.slice(-8)}`;

  const [fromAccId, toAccId] = await Promise.all([
    resolveAccount(client, organizationId, fromCode, fromAccount.accountName, "ASSET" as AccountType),
    resolveAccount(client, organizationId, toCode, toAccount.accountName, "ASSET" as AccountType),
  ]);

  await client.journalEntry.create({
    data: {
      organizationId,
      status: "POSTED",
      journalType: "SYSTEM",
      source: "BANK_TRANSFER",
      postedAt: transferDate,
      entryDate: transferDate,
      reference,
      description: narration.slice(0, 255),
      totalDebit: value,
      totalCredit: value,
      lines: {
        create: [
          { accountId: toAccId, type: "DEBIT", amount: value, description: `Transfer from ${fromAccount.accountName}` },
          { accountId: fromAccId, type: "CREDIT", amount: value, description: `Transfer to ${toAccount.accountName}` },
        ],
      },
    },
  });

  await recomputeAccountBalances(client, organizationId, [toAccId, fromAccId]);
}

// ---------------------------------------------------------------------------
// Recompute and update bank account balance from all transactions.
// Decimal arithmetic only. Errors propagate so a stale balance is never
// silently left behind.
// ---------------------------------------------------------------------------
export async function updateAccountBalance(
  bankAccountId: string,
  organizationId: string,
  client: LedgerClient = prisma
): Promise<void> {
  const [account, agg] = await Promise.all([
    client.bankAccount.findFirst({
      where: { id: bankAccountId, organizationId },
      select: { openingBalance: true },
    }),
    client.bankTransaction.aggregate({
      where: { bankAccountId, organizationId, isIgnored: false, isDuplicate: false },
      _sum: { credit: true, debit: true },
    }),
  ]);
  if (!account) throw new Error(`Bank account ${bankAccountId} not found in organization`);

  const totalCredit = agg._sum.credit ?? ZERO;
  const totalDebit = agg._sum.debit ?? ZERO;
  const computed = new Prisma.Decimal(account.openingBalance).add(totalCredit).sub(totalDebit);

  await client.bankAccount.update({
    where: { id: bankAccountId },
    data: { currentBalance: computed, availableBalance: computed },
  });
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
