// ============================================================
// FinRP Banking OS — Reconciliation Engine
// Implements Zoho-style auto/manual/partial matching of
// bank transactions against invoices, payments, and expenses.
//
// Integrity guarantees:
//  - An entity (invoice/payment/expense) can be confirmed-matched to at
//    most ONE bank transaction (no double settlement).
//  - Confirming a match settles the underlying AR: it records a Payment
//    and updates the invoice's paidAmount / balanceDue / status. Unmatching
//    fully reverses that settlement.
//  - All matching/settlement runs inside a DB transaction and is idempotent
//    on a deterministic reconciliation reference.
//  - Low-confidence auto candidates are stored as SUGGESTIONS only; they
//    never silently settle an invoice.
//  - Every entry point verifies the session/entity belongs to the org.
// ============================================================

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AutoMatchResult } from "./types";

const ZERO = new Prisma.Decimal(0);

// Confidence at/above which an auto-match is treated as confirmed (settles AR).
const AUTO_CONFIRM_THRESHOLD = 0.85;
// Below this we don't even surface a suggestion.
const SUGGEST_THRESHOLD = 0.5;

export class ReconciliationError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message);
    this.name = "ReconciliationError";
  }
}

// Deterministic reference tying a settlement Payment to its bank transaction,
// so settlement is idempotent and reversible.
function reconPaymentRef(bankTransactionId: string): string {
  return `RECON-${bankTransactionId}`;
}

// ---------------------------------------------------------------------------
// Amount tolerance for auto-matching (0.5% or INR 1, whichever is larger)
// ---------------------------------------------------------------------------
function withinTolerance(a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  const tolerance = Math.max(1, Math.abs(a) * 0.005);
  return diff <= tolerance;
}

// ---------------------------------------------------------------------------
// Date proximity for auto-matching (within 5 business days)
// ---------------------------------------------------------------------------
function withinDateWindow(d1: Date, d2: Date, days = 5): boolean {
  const ms = Math.abs(d1.getTime() - d2.getTime());
  return ms <= days * 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Create a new reconciliation session
// ---------------------------------------------------------------------------
export async function createReconcileSession(
  organizationId: string,
  bankAccountId: string,
  opts: {
    name?: string;
    startDate: Date;
    endDate: Date;
    openingBalance?: number;
    closingBalance?: number;
  }
): Promise<string> {
  const txnCount = await prisma.bankTransaction.count({
    where: {
      organizationId,
      bankAccountId,
      transactionDate: { gte: opts.startDate, lte: opts.endDate },
      reconcileStatus: { not: "IGNORED" },
    },
  });

  const session = await prisma.bankReconciliationSession.create({
    data: {
      organizationId,
      bankAccountId,
      name: opts.name,
      startDate: opts.startDate,
      endDate: opts.endDate,
      openingBalance: opts.openingBalance,
      closingBalance: opts.closingBalance,
      totalTxns: txnCount,
      unmatchedTxns: txnCount,
    },
  });
  return session.id;
}

// ---------------------------------------------------------------------------
// Entities already confirmed-matched in this org → "TYPE:id" keys
// ---------------------------------------------------------------------------
async function loadMatchedEntityKeys(organizationId: string): Promise<Set<string>> {
  const matched = await prisma.bankTransaction.findMany({
    where: { organizationId, reconcileStatus: "MATCHED", entityId: { not: null }, entityType: { not: null } },
    select: { entityType: true, entityId: true },
  });
  return new Set(matched.map((m) => `${m.entityType}:${m.entityId}`));
}

// ---------------------------------------------------------------------------
// Auto-match: match unreconciled bank transactions against invoices/payments
// ---------------------------------------------------------------------------
export async function autoMatch(
  sessionId: string,
  organizationId: string
): Promise<{ matched: number; suggested: number }> {
  const session = await prisma.bankReconciliationSession.findFirst({
    where: { id: sessionId, organizationId },
    include: { bankAccount: { select: { id: true } } },
  });
  if (!session) throw new ReconciliationError("Session not found", 404);

  const txns = await prisma.bankTransaction.findMany({
    where: {
      organizationId,
      bankAccountId: session.bankAccountId,
      transactionDate: { gte: session.startDate, lte: session.endDate },
      reconcileStatus: "UNMATCHED",
      isDuplicate: false,
      isIgnored: false,
    },
  });

  // Entities that must not be matched again — seeded from existing matches and
  // extended as we confirm matches in this run (prevents same-run double use).
  const claimed = await loadMatchedEntityKeys(organizationId);

  let matched = 0;
  let suggested = 0;

  for (const txn of txns) {
    const amount = Number(txn.credit ?? txn.debit ?? 0);
    const isCredit = Number(txn.credit ?? 0) > 0;

    const candidates: AutoMatchResult[] = [];

    if (isCredit) {
      // Credit → look for invoices (customer receipts)
      const invoices = await prisma.invoice.findMany({
        where: {
          organizationId,
          deletedAt: null,
          status: { in: ["SENT" as const, "PARTIAL" as const] },
          dueDate: {
            gte: new Date(session.startDate.getTime() - 30 * 24 * 60 * 60 * 1000),
            lte: new Date(session.endDate.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: { id: true, invoiceNumber: true, total: true, dueDate: true },
        take: 20,
      });

      for (const inv of invoices) {
        if (claimed.has(`INVOICE:${inv.id}`)) continue;
        const invAmount = Number(inv.total);
        if (!withinTolerance(amount, invAmount)) continue;
        if (!withinDateWindow(txn.transactionDate, inv.dueDate)) continue;

        const confidence = computeConfidence(txn.narration, inv.invoiceNumber, amount, invAmount);
        candidates.push({
          bankTransactionId: txn.id,
          entityType: "INVOICE",
          entityId: inv.id,
          entityRef: inv.invoiceNumber,
          confidence,
          matchType: confidence >= AUTO_CONFIRM_THRESHOLD ? "AUTO" : "SUGGESTED",
        });
      }
    } else {
      // Debit → look for payments (vendor payments)
      const payments = await prisma.payment.findMany({
        where: {
          organizationId,
          deletedAt: null,
          paidAt: {
            gte: new Date(session.startDate.getTime() - 30 * 24 * 60 * 60 * 1000),
            lte: new Date(session.endDate.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: { id: true, reference: true, amount: true, paidAt: true },
        take: 20,
      });

      for (const pmt of payments) {
        if (claimed.has(`PAYMENT:${pmt.id}`)) continue;
        const pmtAmount = Number(pmt.amount);
        if (!withinTolerance(amount, pmtAmount)) continue;
        if (!withinDateWindow(txn.transactionDate, pmt.paidAt)) continue;

        const confidence = computeConfidence(txn.narration, pmt.reference ?? "", amount, pmtAmount);
        candidates.push({
          bankTransactionId: txn.id,
          entityType: "PAYMENT",
          entityId: pmt.id,
          entityRef: pmt.reference ?? undefined,
          confidence,
          matchType: confidence >= AUTO_CONFIRM_THRESHOLD ? "AUTO" : "SUGGESTED",
        });
      }

      // Debit → also look for recorded expenses
      const expenses = await prisma.expense.findMany({
        where: {
          organizationId,
          deletedAt: null,
          expenseDate: {
            gte: new Date(session.startDate.getTime() - 30 * 24 * 60 * 60 * 1000),
            lte: new Date(session.endDate.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: { id: true, description: true, vendorName: true, amount: true, taxAmount: true, expenseDate: true },
        take: 20,
      });

      for (const exp of expenses) {
        if (claimed.has(`EXPENSE:${exp.id}`)) continue;
        const expAmount = Number(exp.amount) + Number(exp.taxAmount);
        if (!withinTolerance(amount, expAmount)) continue;
        if (!withinDateWindow(txn.transactionDate, exp.expenseDate)) continue;

        const ref = exp.vendorName ?? exp.description;
        const confidence = computeConfidence(txn.narration, ref, amount, expAmount);
        candidates.push({
          bankTransactionId: txn.id,
          entityType: "EXPENSE",
          entityId: exp.id,
          entityRef: ref,
          confidence,
          matchType: confidence >= AUTO_CONFIRM_THRESHOLD ? "AUTO" : "SUGGESTED",
        });
      }
    }

    if (candidates.length === 0) continue;

    // Pick best candidate
    candidates.sort((a, b) => b.confidence - a.confidence);
    const best = candidates[0];
    if (best.confidence < SUGGEST_THRESHOLD) continue;

    if (best.matchType === "AUTO") {
      // High confidence → confirm + settle. Claim the entity so it cannot be
      // reused later in this same run.
      await confirmMatch(organizationId, sessionId, {
        bankTransactionId: best.bankTransactionId,
        entityType: best.entityType,
        entityId: best.entityId,
        entityRef: best.entityRef,
        matchType: "AUTO",
        confidence: best.confidence,
      });
      claimed.add(`${best.entityType}:${best.entityId}`);
      matched++;
    } else {
      // Low confidence → store a suggestion for the user to confirm; do NOT
      // touch the bank transaction status or settle the invoice.
      await storeSuggestion(sessionId, best);
      suggested++;
    }
  }

  await refreshSessionStats(sessionId);
  return { matched, suggested };
}

// ---------------------------------------------------------------------------
// Compute confidence score between a bank txn and an entity
// ---------------------------------------------------------------------------
function computeConfidence(
  narration: string,
  entityRef: string,
  bankAmount: number,
  entityAmount: number
): number {
  let score = 0;

  // Amount similarity (0–0.5)
  const amountDiff = Math.abs(bankAmount - entityAmount);
  const amountPct = bankAmount > 0 ? amountDiff / bankAmount : 1;
  score += Math.max(0, 0.5 - amountPct * 5);

  // Reference match (0–0.3)
  if (entityRef && narration) {
    const refNorm = entityRef.replace(/[-/\s]/g, "").toLowerCase();
    const narNorm = narration.replace(/[-/\s]/g, "").toLowerCase();
    if (narNorm.includes(refNorm) && refNorm.length > 3) score += 0.3;
    else if (refNorm.length > 3 && narNorm.includes(refNorm.slice(0, 6))) score += 0.15;
  }

  // Amount exact match bonus (0.2)
  if (amountDiff < 0.01) score += 0.2;

  return Math.min(1, score);
}

// ---------------------------------------------------------------------------
// Settle an invoice from a matched bank credit (records a Payment + updates
// invoice balances/status). Idempotent on the reconciliation payment ref.
// ---------------------------------------------------------------------------
async function settleInvoiceFromMatch(
  tx: Prisma.TransactionClient,
  organizationId: string,
  invoiceId: string,
  bankTxn: { id: string; credit: Prisma.Decimal | null; bankAccountId: string; referenceNumber: string | null; transactionDate: Date }
): Promise<void> {
  const invoice = await tx.invoice.findFirst({
    where: { id: invoiceId, organizationId },
    select: { id: true, total: true, paidAmount: true, balanceDue: true, status: true },
  });
  if (!invoice) throw new ReconciliationError("Matched invoice not found in this organization", 404);
  if (invoice.status === "CANCELLED") throw new ReconciliationError("Cannot reconcile a cancelled invoice", 422);

  const ref = reconPaymentRef(bankTxn.id);
  const existing = await tx.payment.findFirst({
    where: { invoiceId, organizationId, reference: ref, deletedAt: null },
    select: { id: true },
  });
  if (existing) return; // already settled by this transaction — idempotent

  const credit = bankTxn.credit ?? ZERO;
  const balanceDue = new Prisma.Decimal(invoice.balanceDue);
  if (balanceDue.lessThanOrEqualTo(0) || credit.lessThanOrEqualTo(0)) return;

  const applied = credit.greaterThan(balanceDue) ? balanceDue : credit;
  const newPaid = new Prisma.Decimal(invoice.paidAmount).add(applied);
  const newBalance = new Prisma.Decimal(invoice.total).sub(newPaid);
  const newStatus = newBalance.lessThanOrEqualTo(0) ? "PAID" : "PARTIAL";

  await tx.payment.create({
    data: {
      invoiceId,
      organizationId,
      amount: applied,
      method: "BANK_TRANSFER",
      reference: ref,
      bankAccountId: bankTxn.bankAccountId,
      notes: `Reconciled from bank transaction ${bankTxn.referenceNumber ?? bankTxn.id}`,
      paidAt: bankTxn.transactionDate,
    },
  });

  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      paidAmount: newPaid,
      balanceDue: newBalance.lessThan(0) ? ZERO : newBalance,
      status: newStatus,
    },
  });
}

// ---------------------------------------------------------------------------
// Reverse any invoice settlement created by a bank transaction's match.
// ---------------------------------------------------------------------------
async function reverseInvoiceSettlement(
  tx: Prisma.TransactionClient,
  organizationId: string,
  bankTransactionId: string
): Promise<void> {
  const ref = reconPaymentRef(bankTransactionId);
  const payments = await tx.payment.findMany({
    where: { organizationId, reference: ref, deletedAt: null },
    select: { id: true, invoiceId: true, amount: true },
  });

  for (const p of payments) {
    const invoice = await tx.invoice.findFirst({
      where: { id: p.invoiceId, organizationId },
      select: { id: true, total: true, paidAmount: true },
    });
    await tx.payment.delete({ where: { id: p.id } });

    if (!invoice) continue;
    const newPaidRaw = new Prisma.Decimal(invoice.paidAmount).sub(p.amount);
    const newPaid = newPaidRaw.lessThan(0) ? ZERO : newPaidRaw;
    const newBalance = new Prisma.Decimal(invoice.total).sub(newPaid);
    const newStatus = newPaid.lessThanOrEqualTo(0)
      ? "SENT"
      : newBalance.lessThanOrEqualTo(0)
      ? "PAID"
      : "PARTIAL";

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: newPaid,
        balanceDue: newBalance.lessThan(0) ? ZERO : newBalance,
        status: newStatus,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Confirm a match (AUTO or MANUAL): enforce single-use of the entity,
// link the txn, and settle AR — all atomically.
// ---------------------------------------------------------------------------
async function confirmMatch(
  organizationId: string,
  sessionId: string,
  match: {
    bankTransactionId: string;
    entityType: "INVOICE" | "PAYMENT" | "EXPENSE";
    entityId: string;
    entityRef?: string;
    matchType: "AUTO" | "MANUAL";
    confidence: number;
    notes?: string;
  }
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    // The same entity may not already be confirmed-matched to another txn.
    const dup = await tx.bankTransaction.findFirst({
      where: {
        organizationId,
        entityType: match.entityType,
        entityId: match.entityId,
        reconcileStatus: "MATCHED",
        id: { not: match.bankTransactionId },
      },
      select: { id: true },
    });
    if (dup) {
      throw new ReconciliationError(
        `This ${match.entityType.toLowerCase()} is already reconciled to another bank transaction`,
        409
      );
    }

    // Verify the entity belongs to this org before settling it.
    if (match.entityType === "PAYMENT") {
      const p = await tx.payment.findFirst({ where: { id: match.entityId, organizationId }, select: { id: true } });
      if (!p) throw new ReconciliationError("Matched payment not found in this organization", 404);
    } else if (match.entityType === "EXPENSE") {
      const e = await tx.expense.findFirst({ where: { id: match.entityId, organizationId }, select: { id: true } });
      if (!e) throw new ReconciliationError("Matched expense not found in this organization", 404);
    }

    // Replace any prior match/settlement on this txn (idempotent re-match).
    await reverseInvoiceSettlement(tx, organizationId, match.bankTransactionId);
    await tx.reconciliationMatch.deleteMany({ where: { sessionId, bankTransactionId: match.bankTransactionId } });

    const created = await tx.reconciliationMatch.create({
      data: {
        sessionId,
        bankTransactionId: match.bankTransactionId,
        entityType: match.entityType,
        entityId: match.entityId,
        entityRef: match.entityRef,
        matchType: match.matchType,
        confidence: match.confidence,
        status: "MATCHED",
        notes: match.notes,
      },
    });

    const bankTxn = await tx.bankTransaction.update({
      where: { id: match.bankTransactionId },
      data: {
        reconcileStatus: "MATCHED",
        status: "MATCHED",
        entityType: match.entityType,
        entityId: match.entityId,
      },
      select: { id: true, credit: true, bankAccountId: true, referenceNumber: true, transactionDate: true },
    });

    if (match.entityType === "INVOICE") {
      await settleInvoiceFromMatch(tx, organizationId, match.entityId, bankTxn);
    }

    return created.id;
  });
}

// ---------------------------------------------------------------------------
// Store a low-confidence candidate as a suggestion (no settlement, txn stays
// UNMATCHED). One suggestion row per (session, txn).
// ---------------------------------------------------------------------------
async function storeSuggestion(sessionId: string, match: AutoMatchResult): Promise<void> {
  const existing = await prisma.reconciliationMatch.findFirst({
    where: { sessionId, bankTransactionId: match.bankTransactionId },
    select: { id: true },
  });
  if (existing) return;

  await prisma.reconciliationMatch.create({
    data: {
      sessionId,
      bankTransactionId: match.bankTransactionId,
      entityType: match.entityType,
      entityId: match.entityId,
      entityRef: match.entityRef,
      matchType: "SUGGESTED",
      confidence: match.confidence,
      status: "UNMATCHED",
      notes: match.notes,
    },
  });
}

// ---------------------------------------------------------------------------
// Manual match — user explicitly links txn to entity
// ---------------------------------------------------------------------------
export async function manualMatch(
  sessionId: string,
  organizationId: string,
  bankTransactionId: string,
  entityType: "INVOICE" | "PAYMENT" | "EXPENSE",
  entityId: string,
  entityRef?: string,
  notes?: string
): Promise<string> {
  // Verify session + txn belong to this org before mutating anything.
  const session = await prisma.bankReconciliationSession.findFirst({
    where: { id: sessionId, organizationId },
    select: { id: true, status: true },
  });
  if (!session) throw new ReconciliationError("Session not found", 404);
  if (session.status === "COMPLETED") throw new ReconciliationError("Session already completed", 409);

  const txn = await prisma.bankTransaction.findFirst({
    where: { id: bankTransactionId, organizationId },
    select: { id: true },
  });
  if (!txn) throw new ReconciliationError("Transaction not found", 404);

  const matchId = await confirmMatch(organizationId, sessionId, {
    bankTransactionId,
    entityType,
    entityId,
    entityRef,
    matchType: "MANUAL",
    confidence: 1.0,
    notes,
  });

  await refreshSessionStats(sessionId);
  return matchId;
}

// ---------------------------------------------------------------------------
// Unmatch — remove a reconciliation match and reverse any settlement
// ---------------------------------------------------------------------------
export async function unmatch(
  sessionId: string,
  organizationId: string,
  bankTransactionId: string
): Promise<void> {
  const session = await prisma.bankReconciliationSession.findFirst({
    where: { id: sessionId, organizationId },
    select: { id: true },
  });
  if (!session) throw new ReconciliationError("Session not found", 404);

  await prisma.$transaction(async (tx) => {
    const match = await tx.reconciliationMatch.findFirst({
      where: { sessionId, bankTransactionId },
      select: { id: true },
    });
    if (!match) throw new ReconciliationError("Match not found", 404);

    await reverseInvoiceSettlement(tx, organizationId, bankTransactionId);
    await tx.reconciliationMatch.delete({ where: { id: match.id } });
    await tx.bankTransaction.update({
      where: { id: bankTransactionId },
      data: { reconcileStatus: "UNMATCHED", status: "REVIEWED", entityType: null, entityId: null },
    });
  });

  await refreshSessionStats(sessionId);
}

// ---------------------------------------------------------------------------
// Refresh session counters — "matched" counts bank transactions actually
// marked MATCHED (suggestions, which stay UNMATCHED, are not counted).
// ---------------------------------------------------------------------------
export async function refreshSessionStats(sessionId: string): Promise<void> {
  const session = await prisma.bankReconciliationSession.findUnique({
    where: { id: sessionId },
    select: { startDate: true, endDate: true, bankAccountId: true, organizationId: true },
  });
  if (!session) return;

  const periodFilter = {
    organizationId: session.organizationId,
    bankAccountId: session.bankAccountId,
    transactionDate: { gte: session.startDate, lte: session.endDate },
  };

  const [total, matchedCount, exceptions] = await Promise.all([
    prisma.bankTransaction.count({
      where: { ...periodFilter, reconcileStatus: { not: "IGNORED" } },
    }),
    prisma.bankTransaction.count({
      where: { ...periodFilter, reconcileStatus: "MATCHED" },
    }),
    prisma.bankTransaction.count({
      where: { ...periodFilter, reconcileStatus: "EXCEPTION" },
    }),
  ]);

  await prisma.bankReconciliationSession.update({
    where: { id: sessionId },
    data: {
      totalTxns: total,
      matchedTxns: matchedCount,
      unmatchedTxns: Math.max(0, total - matchedCount - exceptions),
      exceptionTxns: exceptions,
    },
  });
}

// ---------------------------------------------------------------------------
// Complete a reconciliation session
// ---------------------------------------------------------------------------
export async function completeSession(
  sessionId: string,
  organizationId: string
): Promise<void> {
  const session = await prisma.bankReconciliationSession.findFirst({
    where: { id: sessionId, organizationId },
    select: { id: true },
  });
  if (!session) throw new ReconciliationError("Session not found", 404);

  await refreshSessionStats(sessionId);
  await prisma.bankReconciliationSession.update({
    where: { id: sessionId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
}
