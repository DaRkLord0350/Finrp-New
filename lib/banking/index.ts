// ============================================================
// FinRP Banking OS — Public API
// Re-exports all banking service functions for convenience.
// Provider-agnostic engines only — TBX-specific integration code
// lives under lib/tbx/balance, lib/tbx/statements, etc.
// ============================================================

export { categorizeTransaction, bulkCategorize, bulkSetCategory } from "./categorization-engine";
export { filterDuplicates, computeTxnSignature, markInDbDuplicates } from "./duplicate-detector";
export {
  createReconcileSession,
  autoMatch,
  manualMatch,
  unmatch,
  completeSession,
  refreshSessionStats,
} from "./reconciliation-engine";
export {
  generateDailySnapshot,
  generateMonthlySnapshot,
  generateForecast,
  rebuildMonthlySnapshots,
} from "./cash-flow-calculator";
export {
  analyzeTransaction,
  analyzeRecentTransactions,
} from "./risk-detector";
export {
  runInsightGeneration,
  generateAIInsightText,
} from "./insight-generator";
export {
  createCreditJournalEntry,
  createDebitJournalEntry,
  createTransferJournalEntry,
  updateAccountBalance,
} from "./ledger-integration";
