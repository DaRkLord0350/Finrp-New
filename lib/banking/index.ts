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

// Setu AA — provider + services
export { getBankingProvider, SetuProvider, BankingProviderError } from "./providers";
export { initiateConsent, refreshConsentStatus, revokeConsent, linkDiscoveredAccounts } from "./consent-service";
export { runBankSync } from "./sync-service";
export { processBankWebhook, normalizeWebhookPayload } from "./webhook-service";
export {
  enqueueBankSync,
  enqueueBankImport,
  scheduleBankAutoSyncScan,
  BANK_SYNC_QUEUE,
  BANK_IMPORT_QUEUE,
} from "./queue";
export { processBankImport } from "./bank-import-processor";
export { getSetuConfig, isSetuConfigured, SetuConfigError } from "./setu/config";

// Integrations
export { createLinkToken, exchangePublicToken, syncTransactions, syncBalances, processPlaidWebhook } from "./integrations/plaid-client";
export { parseCSV, parseExcel, parsePDF, detectColumnMapping, detectBank } from "./integrations/statement-parser";
