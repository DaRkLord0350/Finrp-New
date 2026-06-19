// ============================================================
// Document → Ledger posting
//
// Turns source documents (invoices, payments, expenses, bills, inventory
// valuation) into balanced double-entry SYSTEM journals. Mirrors the
// banking ledger-integration guarantees:
//   - idempotent on a deterministic `reference` (re-posting never duplicates)
//   - all money math via Prisma.Decimal
//   - respects the period lock (assertPostingAllowed)
//   - errors propagate; a failed posting is never mistaken for success
// Posting is triggered explicitly (manual "Post to Ledger" action).
// ============================================================

import { Prisma, type AccountType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { generateNextJournalNumber } from "@/lib/generators/journal-number";
import { recomputeAccountBalances } from "@/lib/accounting/balances";
import { assertPostingAllowed, resolveFiscalPeriod, PeriodLockedError } from "@/lib/accounting/period";

export class PostingError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message);
    this.name = "PostingError";
  }
}

export type PostingSource = "INVOICE" | "PAYMENT" | "EXPENSE" | "PURCHASE" | "INVENTORY";
type Actor = { userId: string | null };
type Tx = Prisma.TransactionClient;
type Line = { accountId: string; type: "DEBIT" | "CREDIT"; amount: Prisma.Decimal; description: string };

const ZERO = new Prisma.Decimal(0);

async function resolveAccount(tx: Tx, organizationId: string, code: string, name: string, type: AccountType): Promise<string> {
  const a = await tx.account.upsert({
    where: { organizationId_code: { organizationId, code } },
    create: { organizationId, code, name, type, isActive: true, isSystemGenerated: true },
    update: {},
    select: { id: true },
  });
  return a.id;
}

function refFor(source: PostingSource, id: string): string {
  return `${source}-${id}`;
}

/** Shared: create a balanced SYSTEM journal for a source doc (idempotent on reference). */
async function postSystemJournal(
  organizationId: string,
  actor: Actor,
  opts: { source: PostingSource; sourceId: string; entryDate: Date; description: string; lines: Line[]; canOverride?: boolean }
): Promise<{ journalId: string; alreadyPosted: boolean }> {
  const reference = refFor(opts.source, opts.sourceId);

  const existing = await prisma.journalEntry.findFirst({ where: { organizationId, reference, deletedAt: null }, select: { id: true } });
  if (existing) return { journalId: existing.id, alreadyPosted: true };

  await assertPostingAllowed(organizationId, opts.entryDate, { canOverride: opts.canOverride });

  const debit = opts.lines.filter((l) => l.type === "DEBIT").reduce((s, l) => s.add(l.amount), ZERO);
  const credit = opts.lines.filter((l) => l.type === "CREDIT").reduce((s, l) => s.add(l.amount), ZERO);
  if (debit.sub(credit).abs().gt(new Prisma.Decimal("0.01"))) {
    throw new PostingError("Generated journal is not balanced — check the document amounts", 422);
  }

  const fiscal = await resolveFiscalPeriod(organizationId, opts.entryDate);

  const journalId = await prisma.$transaction(async (tx) => {
    const journalNumber = await generateNextJournalNumber(organizationId, { client: tx });
    const je = await tx.journalEntry.create({
      data: {
        organizationId, journalNumber, status: "POSTED", journalType: "SYSTEM",
        reference, description: opts.description, entryDate: opts.entryDate,
        totalDebit: debit, totalCredit: credit,
        createdById: actor.userId, postedById: actor.userId, postedAt: new Date(),
        fiscalYearId: fiscal.fiscalYearId, fiscalPeriodId: fiscal.fiscalPeriodId,
        lines: { create: opts.lines.map((l, i) => ({ accountId: l.accountId, type: l.type, amount: l.amount, description: l.description, lineOrder: i })) },
      },
      select: { id: true },
    });
    await recomputeAccountBalances(tx, organizationId, [...new Set(opts.lines.map((l) => l.accountId))]);
    return je.id;
  });

  await createAuditLog({
    organizationId, userId: actor.userId ?? undefined, action: "POST", entity: opts.source.toLowerCase(), entityId: opts.sourceId,
    description: `Posted ${opts.source.toLowerCase()} ${opts.sourceId} to the ledger (${reference})`,
  });

  return { journalId, alreadyPosted: false };
}

// ── Invoice: Dr A/R, Cr Income (+ Cr Tax Payable) ──────────
export async function postInvoiceToLedger(organizationId: string, invoiceId: string, actor: Actor, canOverride = false) {
  const inv = await prisma.invoice.findFirst({ where: { id: invoiceId, organizationId, deletedAt: null } });
  if (!inv) throw new PostingError("Invoice not found", 404);
  if (inv.status === "DRAFT") throw new PostingError("Draft invoices cannot be posted to the ledger", 422);

  const total = new Prisma.Decimal(inv.total);
  const tax = new Prisma.Decimal(inv.taxAmount);
  const revenue = total.sub(tax);

  const result = await prisma.$transaction(async (tx) => {
    const ar = await resolveAccount(tx, organizationId, "1100", "Accounts Receivable", "ASSET");
    const income = inv.incomeAccountId ?? (await resolveAccount(tx, organizationId, "4000", "Sales", "INCOME"));
    const taxAcc = await resolveAccount(tx, organizationId, "2100", "Tax Payable", "TAX");
    return { ar, income, taxAcc };
  });

  const lines: Line[] = [
    { accountId: result.ar, type: "DEBIT", amount: total, description: `Invoice ${inv.invoiceNumber}` },
    { accountId: result.income, type: "CREDIT", amount: revenue, description: `Invoice ${inv.invoiceNumber} revenue` },
  ];
  if (tax.gt(0)) lines.push({ accountId: result.taxAcc, type: "CREDIT", amount: tax, description: `Invoice ${inv.invoiceNumber} tax` });

  const posted = await postSystemJournal(organizationId, actor, { source: "INVOICE", sourceId: invoiceId, entryDate: inv.issueDate, description: `Invoice ${inv.invoiceNumber}`, lines, canOverride });
  if (!posted.alreadyPosted) await prisma.invoice.update({ where: { id: invoiceId }, data: { journalEntryId: posted.journalId } });
  return posted;
}

// ── Payment: Dr Bank/Cash, Cr A/R ──────────────────────────
export async function postPaymentToLedger(organizationId: string, paymentId: string, actor: Actor, canOverride = false) {
  const pay = await prisma.payment.findFirst({ where: { id: paymentId, organizationId, deletedAt: null } });
  if (!pay) throw new PostingError("Payment not found", 404);
  const amount = new Prisma.Decimal(pay.amount);

  const accs = await prisma.$transaction(async (tx) => {
    const deposit = pay.depositToAccountId ?? (await resolveAccount(tx, organizationId, "1010", "Bank", "BANK"));
    const ar = await resolveAccount(tx, organizationId, "1100", "Accounts Receivable", "ASSET");
    return { deposit, ar };
  });

  const lines: Line[] = [
    { accountId: accs.deposit, type: "DEBIT", amount, description: `Payment ${pay.reference ?? paymentId}` },
    { accountId: accs.ar, type: "CREDIT", amount, description: `Payment against A/R` },
  ];
  const posted = await postSystemJournal(organizationId, actor, { source: "PAYMENT", sourceId: paymentId, entryDate: pay.paidAt, description: `Payment ${pay.reference ?? paymentId}`, lines, canOverride });
  if (!posted.alreadyPosted) await prisma.payment.update({ where: { id: paymentId }, data: { journalEntryId: posted.journalId } });
  return posted;
}

// ── Expense: Dr Expense, Cr Bank/Cash (paid-from) ──────────
const EXPENSE_ACCOUNT_BY_CATEGORY: Record<string, { code: string; name: string }> = {
  RENT: { code: "6100", name: "Rent Expense" },
  UTILITIES: { code: "6110", name: "Utilities Expense" },
  SALARIES: { code: "6200", name: "Salaries & Wages" },
  MARKETING: { code: "6300", name: "Marketing Expense" },
  TRAVEL: { code: "6400", name: "Travel Expense" },
  SOFTWARE: { code: "6500", name: "Software & Subscriptions" },
  EQUIPMENT: { code: "6600", name: "Equipment Expense" },
  LOGISTICS: { code: "6700", name: "Logistics Expense" },
  MAINTENANCE: { code: "6800", name: "Maintenance Expense" },
  TAXES: { code: "6900", name: "Taxes & Duties" },
  OPERATIONS: { code: "6000", name: "Operating Expenses" },
  OTHER: { code: "6950", name: "Other Expenses" },
};

export async function postExpenseToLedger(organizationId: string, expenseId: string, actor: Actor, canOverride = false) {
  const exp = await prisma.expense.findFirst({ where: { id: expenseId, organizationId, deletedAt: null } });
  if (!exp) throw new PostingError("Expense not found", 404);
  const amount = new Prisma.Decimal(exp.amount);

  const map = EXPENSE_ACCOUNT_BY_CATEGORY[exp.category] ?? EXPENSE_ACCOUNT_BY_CATEGORY.OTHER;
  const accs = await prisma.$transaction(async (tx) => {
    const expenseAcc = await resolveAccount(tx, organizationId, map.code, map.name, "EXPENSE");
    const paidFrom = exp.paymentAccountId ?? (await resolveAccount(tx, organizationId, "1010", "Bank", "BANK"));
    return { expenseAcc, paidFrom };
  });

  const lines: Line[] = [
    { accountId: accs.expenseAcc, type: "DEBIT", amount, description: exp.description.slice(0, 200) },
    { accountId: accs.paidFrom, type: "CREDIT", amount, description: `Paid: ${exp.description.slice(0, 180)}` },
  ];
  const posted = await postSystemJournal(organizationId, actor, { source: "EXPENSE", sourceId: expenseId, entryDate: exp.expenseDate, description: `Expense — ${exp.description.slice(0, 120)}`, lines, canOverride });
  if (!posted.alreadyPosted) await prisma.expense.update({ where: { id: expenseId }, data: { journalEntryId: posted.journalId } });
  return posted;
}

// ── Bill / Purchase: Dr Expense/Inventory, Cr A/P ──────────
export async function postPurchaseToLedger(organizationId: string, purchaseId: string, actor: Actor, canOverride = false) {
  const po = await prisma.purchase.findFirst({ where: { id: purchaseId, organizationId, deletedAt: null } });
  if (!po) throw new PostingError("Bill not found", 404);
  const total = new Prisma.Decimal(po.totalAmount);
  const tax = new Prisma.Decimal(po.taxAmount);
  const net = total.sub(tax);

  const accs = await prisma.$transaction(async (tx) => {
    const expenseAcc = po.expenseAccountId ?? (await resolveAccount(tx, organizationId, "6000", "Operating Expenses", "EXPENSE"));
    const ap = await resolveAccount(tx, organizationId, "2000", "Accounts Payable", "LIABILITY");
    const inputTax = await resolveAccount(tx, organizationId, "1300", "Input Tax Credit", "ASSET");
    return { expenseAcc, ap, inputTax };
  });

  const lines: Line[] = [
    { accountId: accs.expenseAcc, type: "DEBIT", amount: net, description: `Bill ${po.purchaseNumber}` },
  ];
  if (tax.gt(0)) lines.push({ accountId: accs.inputTax, type: "DEBIT", amount: tax, description: `Bill ${po.purchaseNumber} input tax` });
  lines.push({ accountId: accs.ap, type: "CREDIT", amount: total, description: `Bill ${po.purchaseNumber} payable` });

  const posted = await postSystemJournal(organizationId, actor, { source: "PURCHASE", sourceId: purchaseId, entryDate: po.purchaseDate, description: `Bill ${po.purchaseNumber}`, lines, canOverride });
  if (!posted.alreadyPosted) await prisma.purchase.update({ where: { id: purchaseId }, data: { journalEntryId: posted.journalId } });
  return posted;
}

// ── Inventory valuation: adjust Inventory Asset to computed value ──
export async function postInventoryValuationToLedger(organizationId: string, asOf: Date, actor: Actor, canOverride = false) {
  const items = await prisma.item.findMany({ where: { organizationId, deletedAt: null, isActive: true }, select: { stock: true, costPrice: true } });
  let computed = ZERO;
  for (const it of items) computed = computed.add(new Prisma.Decimal(it.costPrice).mul(it.stock));

  // Current Inventory Asset balance (1200) from posted ledger.
  const invAcc = await prisma.account.findFirst({ where: { organizationId, code: "1200", deletedAt: null }, select: { id: true, balance: true } });
  const currentBase = invAcc ? new Prisma.Decimal(invAcc.balance) : ZERO;
  const delta = computed.sub(currentBase);
  if (delta.abs().lt(new Prisma.Decimal("0.01"))) {
    throw new PostingError("Inventory value already matches the ledger — no adjustment needed", 422);
  }

  const accs = await prisma.$transaction(async (tx) => {
    const inventory = await resolveAccount(tx, organizationId, "1200", "Inventory Asset", "ASSET");
    const adjustment = await resolveAccount(tx, organizationId, "5050", "Inventory Valuation Adjustment", "COGS");
    return { inventory, adjustment };
  });

  const amt = delta.abs();
  const lines: Line[] = delta.gt(0)
    ? [
        { accountId: accs.inventory, type: "DEBIT", amount: amt, description: "Inventory valuation increase" },
        { accountId: accs.adjustment, type: "CREDIT", amount: amt, description: "Inventory valuation adjustment" },
      ]
    : [
        { accountId: accs.adjustment, type: "DEBIT", amount: amt, description: "Inventory valuation adjustment" },
        { accountId: accs.inventory, type: "CREDIT", amount: amt, description: "Inventory valuation decrease" },
      ];

  // One valuation per as-of date is idempotent.
  return postSystemJournal(organizationId, actor, { source: "INVENTORY", sourceId: asOf.toISOString().slice(0, 10), entryDate: asOf, description: `Inventory valuation as of ${asOf.toISOString().slice(0, 10)}`, lines, canOverride });
}

// ── Unpost: soft-delete the system journal + clear the doc link ──
export async function unpostSource(organizationId: string, source: PostingSource, sourceId: string, actor: Actor) {
  const reference = refFor(source, sourceId);
  const je = await prisma.journalEntry.findFirst({ where: { organizationId, reference, deletedAt: null }, include: { lines: { select: { accountId: true } } } });
  if (!je) throw new PostingError("No ledger posting found for this document", 404);

  await prisma.$transaction(async (tx) => {
    await tx.journalEntry.update({ where: { id: je.id }, data: { deletedAt: new Date(), status: "VOID" } });
    if (source === "INVOICE") await tx.invoice.updateMany({ where: { id: sourceId, organizationId }, data: { journalEntryId: null } });
    if (source === "PAYMENT") await tx.payment.updateMany({ where: { id: sourceId, organizationId }, data: { journalEntryId: null } });
    if (source === "EXPENSE") await tx.expense.updateMany({ where: { id: sourceId, organizationId }, data: { journalEntryId: null } });
    if (source === "PURCHASE") await tx.purchase.updateMany({ where: { id: sourceId, organizationId }, data: { journalEntryId: null } });
    await recomputeAccountBalances(tx, organizationId, [...new Set(je.lines.map((l) => l.accountId))]);
  });

  await createAuditLog({
    organizationId, userId: actor.userId ?? undefined, action: "REVERSE", entity: source.toLowerCase(), entityId: sourceId,
    description: `Unposted ${source.toLowerCase()} ${sourceId} from the ledger`,
  });
}

// ── Unposted documents for the posting UI ──────────────────
export async function listUnpostedDocuments(organizationId: string) {
  const [invoices, payments, expenses, purchases] = await Promise.all([
    prisma.invoice.findMany({ where: { organizationId, deletedAt: null, journalEntryId: null, status: { notIn: ["DRAFT", "CANCELLED"] } }, select: { id: true, invoiceNumber: true, total: true, issueDate: true }, orderBy: { issueDate: "desc" }, take: 100 }),
    prisma.payment.findMany({ where: { organizationId, deletedAt: null, journalEntryId: null }, select: { id: true, amount: true, paidAt: true, reference: true }, orderBy: { paidAt: "desc" }, take: 100 }),
    prisma.expense.findMany({ where: { organizationId, deletedAt: null, journalEntryId: null }, select: { id: true, description: true, amount: true, expenseDate: true }, orderBy: { expenseDate: "desc" }, take: 100 }),
    prisma.purchase.findMany({ where: { organizationId, deletedAt: null, journalEntryId: null }, select: { id: true, purchaseNumber: true, totalAmount: true, purchaseDate: true }, orderBy: { purchaseDate: "desc" }, take: 100 }),
  ]);
  return { invoices, payments, expenses, purchases };
}

// ── Dispatch + posted-status helpers for the UI ────────────
export function postDocument(organizationId: string, source: PostingSource, sourceId: string, actor: Actor, canOverride = false) {
  switch (source) {
    case "INVOICE": return postInvoiceToLedger(organizationId, sourceId, actor, canOverride);
    case "PAYMENT": return postPaymentToLedger(organizationId, sourceId, actor, canOverride);
    case "EXPENSE": return postExpenseToLedger(organizationId, sourceId, actor, canOverride);
    case "PURCHASE": return postPurchaseToLedger(organizationId, sourceId, actor, canOverride);
    case "INVENTORY": return postInventoryValuationToLedger(organizationId, new Date(sourceId), actor, canOverride);
    default: throw new PostingError(`Unknown posting source: ${source}`, 400);
  }
}

export { PeriodLockedError };
