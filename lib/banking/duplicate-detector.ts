// ============================================================
// FinRP Banking OS — Duplicate Transaction Detector
// Uses composite signature hash to detect duplicates before insert.
// ============================================================

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { ParsedBankTransaction } from "./types";

// ---------------------------------------------------------------------------
// Compute a deterministic signature for a transaction.
// Two transactions are considered the same if date + amount + narration match.
// We normalise the narration to strip variable parts (UTR numbers, etc.)
// ---------------------------------------------------------------------------
export function computeTxnSignature(
  bankAccountId: string,
  txn: Pick<ParsedBankTransaction, "transactionDate" | "narration" | "credit" | "debit" | "referenceNumber">
): string {
  const dateStr = txn.transactionDate.toISOString().slice(0, 10);
  const amount = ((txn.credit ?? 0) - (txn.debit ?? 0)).toFixed(2);
  const narrationNorm = normalisedNarration(txn.narration);
  const refNorm = (txn.referenceNumber ?? "").slice(0, 16);

  const raw = `${bankAccountId}|${dateStr}|${amount}|${narrationNorm}|${refNorm}`;
  return createHash("sha256").update(raw).digest("hex");
}

function normalisedNarration(text: string): string {
  return text
    .toUpperCase()
    .replace(/[0-9]{10,}/g, "NUM")    // remove long numeric strings (UTR, acc no.)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

// ---------------------------------------------------------------------------
// Check if a single transaction already exists (by signature OR referenceNumber)
// ---------------------------------------------------------------------------
export async function isDuplicate(
  bankAccountId: string,
  txn: ParsedBankTransaction
): Promise<boolean> {
  const sig = computeTxnSignature(bankAccountId, txn);

  // Primary check — referenceNumber exact match (strongest signal)
  if (txn.referenceNumber && txn.referenceNumber.length > 4) {
    const existing = await prisma.bankTransaction.findFirst({
      where: { bankAccountId, referenceNumber: txn.referenceNumber },
      select: { id: true },
    });
    if (existing) return true;
  }

  // Fallback — fuzzy signature match
  const sigMatch = await prisma.bankTransaction.findFirst({
    where: {
      bankAccountId,
      metadata: { path: ["sig"], equals: sig },
    },
    select: { id: true },
  });
  return !!sigMatch;
}

// ---------------------------------------------------------------------------
// Filter a batch of parsed transactions, returning only non-duplicates.
// Returns: { unique, duplicateCount }
// ---------------------------------------------------------------------------
export async function filterDuplicates(
  bankAccountId: string,
  transactions: ParsedBankTransaction[]
): Promise<{ unique: ParsedBankTransaction[]; duplicateCount: number }> {
  if (transactions.length === 0) return { unique: [], duplicateCount: 0 };

  // Build a set of reference numbers that already exist in DB
  const refNums = transactions
    .map(t => t.referenceNumber)
    .filter((r): r is string => !!r && r.length > 4);

  const existingRefs = new Set<string>();
  if (refNums.length > 0) {
    const rows = await prisma.bankTransaction.findMany({
      where: { bankAccountId, referenceNumber: { in: refNums } },
      select: { referenceNumber: true },
    });
    rows.forEach(r => { if (r.referenceNumber) existingRefs.add(r.referenceNumber); });
  }

  // Build signatures for all parsed txns
  const sigMap = new Map<string, boolean>();
  const unique: ParsedBankTransaction[] = [];
  let duplicateCount = 0;

  for (const txn of transactions) {
    if (txn.referenceNumber && existingRefs.has(txn.referenceNumber)) {
      duplicateCount++;
      continue;
    }
    const sig = computeTxnSignature(bankAccountId, txn);
    if (sigMap.has(sig)) {
      duplicateCount++;
      continue;
    }
    sigMap.set(sig, true);
    unique.push(txn);
  }

  return { unique, duplicateCount };
}

// ---------------------------------------------------------------------------
// After inserting, mark any in-DB duplicates that share same ref/amount/date
// (handles the case where two sync sources push the same txn)
// ---------------------------------------------------------------------------
export async function markInDbDuplicates(
  bankAccountId: string,
  windowDays = 1
): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const txns = await prisma.bankTransaction.findMany({
    where: {
      bankAccountId,
      transactionDate: { gte: since },
      isDuplicate: false,
    },
    select: { id: true, transactionDate: true, credit: true, debit: true, narration: true, referenceNumber: true },
    orderBy: { transactionDate: "asc" },
  });

  const seen = new Map<string, string>();
  const duplicateIds: string[] = [];

  for (const t of txns) {
    const key = `${t.transactionDate.toISOString().slice(0, 10)}|${Number(t.credit ?? 0).toFixed(2)}|${Number(t.debit ?? 0).toFixed(2)}|${normalisedNarration(t.narration)}`;
    if (seen.has(key)) {
      duplicateIds.push(t.id);
    } else {
      seen.set(key, t.id);
    }
  }

  if (duplicateIds.length === 0) return 0;

  await prisma.bankTransaction.updateMany({
    where: { id: { in: duplicateIds } },
    data: { isDuplicate: true, reconcileStatus: "DUPLICATE" },
  });

  return duplicateIds.length;
}
