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
//  - Each bank account gets its own ledger Account (`BA-<id suffix>`),
//    never a shared hardcoded code — otherwise multiple bank accounts
//    would collapse onto the same ledger cash account.
// ============================================================

import { Prisma, type AccountType, type BankTxnType } from "@prisma/client";
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

/** Per-account-safe ledger code — never a hardcoded shared code (see file header). */
function bankAccountLedgerCode(bankAccountId: string): string {
  return `BA-${bankAccountId.slice(-8)}`;
}

// ---------------------------------------------------------------------------
// Idempotency guard — returns the existing journal id when a posting with
// this reference already exists, so callers can still link back to it.
// ---------------------------------------------------------------------------
async function findExistingPosting(
  client: LedgerClient,
  organizationId: string,
  reference: string
): Promise<string | null> {
  const existing = await client.journalEntry.findFirst({
    where: { organizationId, reference, deletedAt: null },
    select: { id: true },
  });
  return existing?.id ?? null;
}

export interface PostingOutcome {
  journalId: string;
  alreadyPosted: boolean;
}

// ---------------------------------------------------------------------------
// Map a bank transaction's category → chart of accounts, by direction.
// Covers the brief's examples: Salary→Salary Expense, GST→GST Ledger,
// Vendor→Accounts Payable, Customer→Accounts Receivable, Interest→Interest
// Income, Charges→Bank Charges.
// ---------------------------------------------------------------------------
interface LedgerAccountInfo {
  code: string;
  name: string;
  type: AccountType;
}

const CREDIT_ACCOUNT_BY_TXN_TYPE: Partial<Record<BankTxnType, LedgerAccountInfo>> = {
  CUSTOMER_RECEIPT: { code: "1200", name: "Accounts Receivable", type: "ASSET" },
  INTEREST: { code: "4900", name: "Interest Income", type: "INCOME" },
  DIVIDEND: { code: "4910", name: "Dividend Income", type: "INCOME" },
  REFUND: { code: "1200", name: "Accounts Receivable", type: "ASSET" },
  REVERSAL: { code: "1200", name: "Accounts Receivable", type: "ASSET" },
};
const CREDIT_FALLBACK: LedgerAccountInfo = { code: "4990", name: "Other Income", type: "INCOME" };

const DEBIT_ACCOUNT_BY_TXN_TYPE: Partial<Record<BankTxnType, LedgerAccountInfo>> = {
  SALARY: { code: "5100", name: "Salaries & Wages", type: "EXPENSE" },
  GST_PAYMENT: { code: "2300", name: "GST Payable", type: "LIABILITY" },
  TDS_PAYMENT: { code: "2310", name: "TDS Payable", type: "LIABILITY" },
  VENDOR_PAYMENT: { code: "2000", name: "Accounts Payable", type: "LIABILITY" },
  BANK_CHARGE: { code: "5900", name: "Bank Charges", type: "EXPENSE" },
  LOAN_EMI: { code: "2500", name: "Loan Repayment", type: "LIABILITY" },
};
const DEBIT_FALLBACK: LedgerAccountInfo = { code: "5000", name: "General Expenses", type: "EXPENSE" };

function resolveCreditAccount(txnType?: BankTxnType | null): LedgerAccountInfo {
  return (txnType && CREDIT_ACCOUNT_BY_TXN_TYPE[txnType]) ?? CREDIT_FALLBACK;
}

function resolveDebitAccount(txnType?: BankTxnType | null): LedgerAccountInfo {
  return (txnType && DEBIT_ACCOUNT_BY_TXN_TYPE[txnType]) ?? DEBIT_FALLBACK;
}

// ---------------------------------------------------------------------------
// Create journal entry for a bank credit (money received)
// Dr: Bank Account   Cr: category-mapped account (default Accounts Receivable)
// ---------------------------------------------------------------------------
export async function createCreditJournalEntry(
  organizationId: string,
  bankAccountId: string,
  amount: Prisma.Decimal.Value,
  narration: string,
  transactionDate: Date,
  opts: { txnType?: BankTxnType | null; reference?: string; entityType?: string; entityId?: string; client?: LedgerClient } = {}
): Promise<PostingOutcome> {
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

  const existingId = await findExistingPosting(client, organizationId, reference);
  if (existingId) return { journalId: existingId, alreadyPosted: true };

  const creditInfo = resolveCreditAccount(opts.txnType);
  const [bankAccId, creditAccId] = await Promise.all([
    resolveAccount(client, organizationId, bankAccountLedgerCode(bankAccountId), bankAccount.accountName, "ASSET" as AccountType),
    resolveAccount(client, organizationId, creditInfo.code, creditInfo.name, creditInfo.type),
  ]);

  const je = await client.journalEntry.create({
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
          { accountId: creditAccId, type: "CREDIT", amount: value, description: narration.slice(0, 255) },
        ],
      },
    },
    select: { id: true },
  });

  await recomputeAccountBalances(client, organizationId, [bankAccId, creditAccId]);
  return { journalId: je.id, alreadyPosted: false };
}

// ---------------------------------------------------------------------------
// Create journal entry for a bank debit (money paid)
// Dr: category-mapped account (default General Expenses)   Cr: Bank Account
// ---------------------------------------------------------------------------
export async function createDebitJournalEntry(
  organizationId: string,
  bankAccountId: string,
  amount: Prisma.Decimal.Value,
  narration: string,
  transactionDate: Date,
  opts: { txnType?: BankTxnType | null; reference?: string; entityType?: string; entityId?: string; client?: LedgerClient } = {}
): Promise<PostingOutcome> {
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

  const existingId = await findExistingPosting(client, organizationId, reference);
  if (existingId) return { journalId: existingId, alreadyPosted: true };

  const debitInfo = resolveDebitAccount(opts.txnType);
  const [debitAccId, bankAccId] = await Promise.all([
    resolveAccount(client, organizationId, debitInfo.code, debitInfo.name, debitInfo.type),
    resolveAccount(client, organizationId, bankAccountLedgerCode(bankAccountId), bankAccount.accountName, "ASSET" as AccountType),
  ]);

  const je = await client.journalEntry.create({
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
          { accountId: debitAccId, type: "DEBIT", amount: value, description: narration.slice(0, 255) },
          { accountId: bankAccId, type: "CREDIT", amount: value, description: narration.slice(0, 255) },
        ],
      },
    },
    select: { id: true },
  });

  await recomputeAccountBalances(client, organizationId, [debitAccId, bankAccId]);
  return { journalId: je.id, alreadyPosted: false };
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
  if (await findExistingPosting(client, organizationId, reference)) return;

  const [fromAccId, toAccId] = await Promise.all([
    resolveAccount(client, organizationId, bankAccountLedgerCode(fromAccountId), fromAccount.accountName, "ASSET" as AccountType),
    resolveAccount(client, organizationId, bankAccountLedgerCode(toAccountId), toAccount.accountName, "ASSET" as AccountType),
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
