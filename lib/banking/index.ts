// ============================================================
// FinRP Banking OS — Public API
// Re-exports all banking service functions for convenience.
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

// Integrations
export { createConsent, syncConsentStatus, fetchAndStoreTransactions, processSetuWebhook } from "./integrations/setu-aa";
export { createLinkToken, exchangePublicToken, syncTransactions, syncBalances, processPlaidWebhook } from "./integrations/plaid-client";
export { parseCSV, parseExcel, parsePDF, detectColumnMapping, detectBank } from "./integrations/statement-parser";

// Workers
export { createBankSyncWorker, BANK_SYNC_QUEUE } from "./workers/bank-sync.worker";
export { createBankImportWorker, getBankImportQueue, enqueueBankImport, BANK_IMPORT_QUEUE } from "./workers/bank-import.worker";
