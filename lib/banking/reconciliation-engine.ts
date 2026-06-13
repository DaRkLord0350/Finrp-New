// ============================================================
// FinRP Banking OS — Reconciliation Engine
// Implements Zoho-style auto/manual/partial matching of
// bank transactions against invoices, payments, and expenses.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { AutoMatchResult } from "./types";

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
// Auto-match: match unreconciled bank transactions against invoices/payments
// Returns array of match candidates
// ---------------------------------------------------------------------------
export async function autoMatch(
  sessionId: string,
  organizationId: string
): Promise<{ matched: number; suggested: number }> {
  const session = await prisma.bankReconciliationSession.findUnique({
    where: { id: sessionId },
    include: { bankAccount: { select: { id: true } } },
  });
  if (!session) throw new Error("Session not found");

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
          matchType: confidence >= 0.85 ? "AUTO" : "SUGGESTED",
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
          matchType: confidence >= 0.85 ? "AUTO" : "SUGGESTED",
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
          matchType: confidence >= 0.85 ? "AUTO" : "SUGGESTED",
        });
      }
    }

    if (candidates.length === 0) continue;

    // Pick best candidate
    candidates.sort((a, b) => b.confidence - a.confidence);
    const best = candidates[0];

    if (best.confidence >= 0.5) {
      await applyMatch(sessionId, organizationId, best);
      if (best.matchType === "AUTO") matched++;
      else suggested++;
    }
  }

  // Update session counters
  const matchedCount = await prisma.reconciliationMatch.count({
    where: { sessionId },
  });
  const totalTxns = txns.length;
  await prisma.bankReconciliationSession.update({
    where: { id: sessionId },
    data: {
      matchedTxns: matchedCount,
      unmatchedTxns: Math.max(0, totalTxns - matchedCount),
    },
  });

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
// Apply a match (auto or manual)
// ---------------------------------------------------------------------------
async function applyMatch(
  sessionId: string,
  organizationId: string,
  match: AutoMatchResult
): Promise<void> {
  await prisma.$transaction([
    prisma.reconciliationMatch.create({
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
    }),
    prisma.bankTransaction.update({
      where: { id: match.bankTransactionId },
      data: {
        reconcileStatus: "MATCHED",
        status: "MATCHED",
        entityType: match.entityType,
        entityId: match.entityId,
      },
    }),
  ]);
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
  // Verify txn belongs to org
  const txn = await prisma.bankTransaction.findFirst({
    where: { id: bankTransactionId, organizationId },
  });
  if (!txn) throw new Error("Transaction not found");

  // Check no existing match
  const existing = await prisma.reconciliationMatch.findFirst({
    where: { sessionId, bankTransactionId },
  });
  if (existing) {
    // Replace existing match
    await prisma.reconciliationMatch.delete({ where: { id: existing.id } });
  }

  const match = await prisma.reconciliationMatch.create({
    data: {
      sessionId,
      bankTransactionId,
      entityType,
      entityId,
      entityRef,
      matchType: "MANUAL",
      confidence: 1.0,
      status: "MATCHED",
      notes,
    },
  });

  await prisma.bankTransaction.update({
    where: { id: bankTransactionId },
    data: {
      reconcileStatus: "MATCHED",
      status: "MATCHED",
      entityType,
      entityId,
    },
  });

  await refreshSessionStats(sessionId);
  return match.id;
}

// ---------------------------------------------------------------------------
// Unmatch — remove a reconciliation match
// ---------------------------------------------------------------------------
export async function unmatch(
  sessionId: string,
  organizationId: string,
  bankTransactionId: string
): Promise<void> {
  const match = await prisma.reconciliationMatch.findFirst({
    where: { sessionId, bankTransactionId },
  });
  if (!match) throw new Error("Match not found");

  await prisma.$transaction([
    prisma.reconciliationMatch.delete({ where: { id: match.id } }),
    prisma.bankTransaction.update({
      where: { id: bankTransactionId },
      data: { reconcileStatus: "UNMATCHED", status: "REVIEWED", entityType: null, entityId: null },
    }),
  ]);

  await refreshSessionStats(sessionId);
}

// ---------------------------------------------------------------------------
// Refresh session counters
// ---------------------------------------------------------------------------
export async function refreshSessionStats(sessionId: string): Promise<void> {
  const session = await prisma.bankReconciliationSession.findUnique({
    where: { id: sessionId },
    select: { startDate: true, endDate: true, bankAccountId: true, organizationId: true },
  });
  if (!session) return;

  const [total, matchedCount, exceptions] = await Promise.all([
    prisma.bankTransaction.count({
      where: {
        bankAccountId: session.bankAccountId,
        transactionDate: { gte: session.startDate, lte: session.endDate },
        reconcileStatus: { not: "IGNORED" },
      },
    }),
    prisma.reconciliationMatch.count({ where: { sessionId } }),
    prisma.bankTransaction.count({
      where: {
        bankAccountId: session.bankAccountId,
        transactionDate: { gte: session.startDate, lte: session.endDate },
        reconcileStatus: "EXCEPTION",
      },
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
  await refreshSessionStats(sessionId);
  await prisma.bankReconciliationSession.update({
    where: { id: sessionId, organizationId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
}
