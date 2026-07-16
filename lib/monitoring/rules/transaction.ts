// ============================================================
// lib/monitoring/rules/transaction.ts
//
// Pure detection logic over already-fetched BankTransaction/
// BankAccount rows — genuinely new detectors (nothing in the
// existing Banking OS module currently alerts on these patterns,
// it only categorizes/reconciles).
// ============================================================

export interface TxnLike {
  id: string;
  amount: number; // credit or debit magnitude, always positive
  txnType: string;
  transactionDate: string; // ISO
}

export function detectHighCashTransactions(transactions: TxnLike[], amountThreshold: number): TxnLike[] {
  return transactions.filter((t) => t.txnType === "CASH" && t.amount >= amountThreshold);
}

export function detectLargeTransactions(transactions: TxnLike[], amountThreshold: number): TxnLike[] {
  return transactions.filter((t) => t.amount >= amountThreshold);
}

/** True if the account's most recent transaction is older than `dormancyDays`, or it has never transacted at all past its opening. */
export function isDormantAccount(lastTransactionDate: Date | null, accountOpenedAt: Date, dormancyDays: number, now: Date = new Date()): boolean {
  const reference = lastTransactionDate ?? accountOpenedAt;
  const idleDays = (now.getTime() - reference.getTime()) / 86_400_000;
  return idleDays >= dormancyDays;
}
