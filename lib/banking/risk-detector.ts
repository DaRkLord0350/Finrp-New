// ============================================================
// FinRP Banking OS — Risk & Fraud Detection Engine
// Runs heuristic checks on new transactions and creates
// BankRiskAlert records when anomalies are detected.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { RiskCheckResult } from "./types";

const HIGH_VALUE_THRESHOLD_INR = 500_000;   // 5 Lakhs
const LARGE_WITHDRAWAL_THRESHOLD = 200_000; // 2 Lakhs
const ROUND_TRIP_WINDOW_HOURS = 48;
const DUPLICATE_WINDOW_HOURS = 24;

// ---------------------------------------------------------------------------
// Run all risk checks for a given transaction
// ---------------------------------------------------------------------------
export async function analyzeTransaction(
  transactionId: string,
  organizationId: string
): Promise<void> {
  const txn = await prisma.bankTransaction.findUnique({
    where: { id: transactionId },
    include: { bankAccount: { select: { id: true } } },
  });
  if (!txn) return;

  const alerts: RiskCheckResult[] = [];

  alerts.push(...(await checkDuplicatePayment(txn, organizationId)));
  alerts.push(...checkHighValue(txn));
  alerts.push(...checkLargeWithdrawal(txn));
  alerts.push(...(await checkRoundTripping(txn, organizationId)));
  alerts.push(...(await checkDormantActivity(txn, organizationId)));

  for (const alert of alerts) {
    const existing = await prisma.bankRiskAlert.findFirst({
      where: {
        organizationId,
        bankTransactionId: transactionId,
        riskType: alert.riskType as never,
        status: { in: ["OPEN", "INVESTIGATING"] },
      },
    });
    if (existing) continue;

    await prisma.bankRiskAlert.create({
      data: {
        organizationId,
        bankTransactionId: transactionId,
        riskType: alert.riskType as never,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        metadata: (alert.metadata ?? null) as never,
        status: "OPEN",
      },
    });
  }

  if (alerts.length > 0) {
    await prisma.bankTransaction.update({
      where: { id: transactionId },
      data: { isFlagged: true, requiresApproval: alerts.some(a => a.severity === "CRITICAL" || a.severity === "HIGH") },
    });
  }
}

// ---------------------------------------------------------------------------
// Duplicate payment: same amount + similar narration within 24h
// ---------------------------------------------------------------------------
async function checkDuplicatePayment(
  txn: { id: string; transactionDate: Date; credit: { toString(): string } | null; debit: { toString(): string } | null; narration: string; bankAccountId: string },
  organizationId: string
): Promise<RiskCheckResult[]> {
  const amount = Number(txn.debit ?? 0);
  if (amount < 100) return [];

  const windowStart = new Date(txn.transactionDate.getTime() - DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000);
  const windowEnd = new Date(txn.transactionDate.getTime() + DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000);

  const similar = await prisma.bankTransaction.findFirst({
    where: {
      organizationId,
      bankAccountId: txn.bankAccountId,
      id: { not: txn.id },
      debit: { gte: amount * 0.995, lte: amount * 1.005 },
      transactionDate: { gte: windowStart, lte: windowEnd },
    },
  });

  if (!similar) return [];

  return [{
    riskType: "DUPLICATE_PAYMENT",
    severity: amount > 100_000 ? "HIGH" : "MEDIUM",
    title: "Possible Duplicate Payment",
    description: `A similar payment of ₹${amount.toLocaleString("en-IN")} was found within ${DUPLICATE_WINDOW_HOURS}h. Verify if this is a duplicate.`,
    metadata: { relatedTxnId: similar.id, amount, windowHours: DUPLICATE_WINDOW_HOURS },
  }];
}

// ---------------------------------------------------------------------------
// High value transaction
// ---------------------------------------------------------------------------
function checkHighValue(
  txn: { credit: { toString(): string } | null; debit: { toString(): string } | null }
): RiskCheckResult[] {
  const amount = Math.max(Number(txn.credit ?? 0), Number(txn.debit ?? 0));
  if (amount < HIGH_VALUE_THRESHOLD_INR) return [];

  return [{
    riskType: "HIGH_VALUE_TRANSACTION",
    severity: amount >= 2_000_000 ? "CRITICAL" : "HIGH",
    title: "High Value Transaction",
    description: `Transaction of ₹${amount.toLocaleString("en-IN")} exceeds threshold. Review required.`,
    metadata: { amount, threshold: HIGH_VALUE_THRESHOLD_INR },
  }];
}

// ---------------------------------------------------------------------------
// Large withdrawal
// ---------------------------------------------------------------------------
function checkLargeWithdrawal(
  txn: { debit: { toString(): string } | null }
): RiskCheckResult[] {
  const amount = Number(txn.debit ?? 0);
  if (amount < LARGE_WITHDRAWAL_THRESHOLD) return [];

  return [{
    riskType: "LARGE_WITHDRAWAL",
    severity: amount >= 1_000_000 ? "HIGH" : "MEDIUM",
    title: "Large Cash Withdrawal",
    description: `Withdrawal of ₹${amount.toLocaleString("en-IN")} is above normal threshold.`,
    metadata: { amount },
  }];
}

// ---------------------------------------------------------------------------
// Round tripping: debit followed by similar credit (or vice versa) within 48h
// ---------------------------------------------------------------------------
async function checkRoundTripping(
  txn: { id: string; transactionDate: Date; credit: { toString(): string } | null; debit: { toString(): string } | null; bankAccountId: string },
  organizationId: string
): Promise<RiskCheckResult[]> {
  const isDebit = Number(txn.debit ?? 0) > 0;
  const amount = isDebit ? Number(txn.debit) : Number(txn.credit);
  if (amount < 10_000) return [];

  const windowStart = new Date(txn.transactionDate.getTime() - ROUND_TRIP_WINDOW_HOURS * 3_600_000);
  const windowEnd = new Date(txn.transactionDate.getTime() + ROUND_TRIP_WINDOW_HOURS * 3_600_000);

  const opposite = await prisma.bankTransaction.findFirst({
    where: {
      organizationId,
      id: { not: txn.id },
      transactionDate: { gte: windowStart, lte: windowEnd },
      ...(isDebit
        ? { credit: { gte: amount * 0.995, lte: amount * 1.005 } }
        : { debit: { gte: amount * 0.995, lte: amount * 1.005 } }),
    },
  });

  if (!opposite) return [];

  return [{
    riskType: "ROUND_TRIPPING",
    severity: "HIGH",
    title: "Potential Round-Tripping Detected",
    description: `A matching ${isDebit ? "credit" : "debit"} of ₹${amount.toLocaleString("en-IN")} found within ${ROUND_TRIP_WINDOW_HOURS}h. Investigate for funds cycling.`,
    metadata: { relatedTxnId: opposite.id, amount },
  }];
}

// ---------------------------------------------------------------------------
// Dormant account activity: first transaction after 90 days of inactivity
// ---------------------------------------------------------------------------
async function checkDormantActivity(
  txn: { id: string; transactionDate: Date; bankAccountId: string; credit: { toString(): string } | null; debit: { toString(): string } | null },
  organizationId: string
): Promise<RiskCheckResult[]> {
  const dormantThreshold = new Date(txn.transactionDate.getTime() - 90 * 24 * 3_600_000);

  const recent = await prisma.bankTransaction.findFirst({
    where: {
      organizationId,
      bankAccountId: txn.bankAccountId,
      id: { not: txn.id },
      transactionDate: { gte: dormantThreshold, lt: txn.transactionDate },
    },
    orderBy: { transactionDate: "desc" },
  });

  if (recent) return [];

  const anyOlder = await prisma.bankTransaction.findFirst({
    where: {
      organizationId,
      bankAccountId: txn.bankAccountId,
      id: { not: txn.id },
      transactionDate: { lt: dormantThreshold },
    },
  });
  if (!anyOlder) return [];

  return [{
    riskType: "DORMANT_ACTIVITY",
    severity: "MEDIUM",
    title: "Activity on Dormant Account",
    description: "This account had no activity for over 90 days. Review whether this transaction is expected.",
    metadata: { dormantSinceDays: 90 },
  }];
}

// ---------------------------------------------------------------------------
// Batch analyze recent transactions (called after bulk import/sync)
// ---------------------------------------------------------------------------
export async function analyzeRecentTransactions(
  organizationId: string,
  bankAccountId: string,
  sinceDate: Date
): Promise<void> {
  const txns = await prisma.bankTransaction.findMany({
    where: {
      organizationId,
      bankAccountId,
      createdAt: { gte: sinceDate },
      isFlagged: false,
    },
    select: { id: true },
    take: 100,
  });

  for (const t of txns) {
    await analyzeTransaction(t.id, organizationId).catch(err => {
      console.error(`[risk] analyzeTransaction ${t.id} failed:`, err.message);
    });
  }
}
