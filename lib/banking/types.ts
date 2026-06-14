// ============================================================
// FinRP Banking OS — Core TypeScript Types
// ============================================================

export interface ParsedBankTransaction {
  transactionDate: Date;
  valueDate?: Date;
  narration: string;
  credit?: number;
  debit?: number;
  balance?: number;
  referenceNumber?: string;
  chequeNumber?: string;
  txnType?: string;
}

export interface StatementParseResult {
  transactions: ParsedBankTransaction[];
  totalRows: number;
  errorRows: number;
  duplicateRows: number;
  detectedBank?: string;
  errors: Array<{ row: number; message: string }>;
  columnMapping?: Record<string, string>;
}

export interface RuleCondition {
  field: "narration" | "amount" | "credit" | "debit" | "referenceNumber" | "txnType";
  operator: "contains" | "starts_with" | "ends_with" | "equals" | "gt" | "lt" | "gte" | "lte" | "regex";
  value: string | number;
  logic?: "AND" | "OR";
}

export interface RuleAction {
  type: "set_category" | "set_subcategory" | "set_txn_type" | "flag" | "add_tag" | "set_gst_category";
  value: string;
}

export interface AutoMatchResult {
  bankTransactionId: string;
  entityType: "INVOICE" | "PAYMENT" | "EXPENSE";
  entityId: string;
  entityRef?: string;
  confidence: number;
  matchType: "AUTO" | "SUGGESTED";
  notes?: string;
}

export interface ReconcileSessionStats {
  totalTxns: number;
  matchedTxns: number;
  unmatchedTxns: number;
  exceptionTxns: number;
  matchRate: number;
  openingBalance: number;
  closingBalance: number;
}

export interface CashFlowBreakdown {
  categories: Record<string, { inflow: number; outflow: number }>;
  topCreditors: Array<{ name: string; amount: number }>;
  topDebitors: Array<{ name: string; amount: number }>;
}

export interface SetuConsentRequest {
  redirectUrl: string;
  dateRange: { from: string; to: string };
  consentTypes: string[];
  fiTypes: string[];
  frequency?: { unit: string; value: number };
}

export interface SetuFISession {
  sessionId: string;
  consentId: string;
  dateRange: { from: string; to: string };
}

export interface SetuFIData {
  account: {
    maskedAccNumber: string;
    linkedAccRef: string;
    summary?: {
      currentBalance: number;
      currency: string;
      exchgeRate?: string;
    };
  };
  transactions: Array<{
    txnId: string;
    type: "CREDIT" | "DEBIT";
    mode: string;
    amount: number;
    currentBalance: number;
    transactionTimestamp: string;
    valueDate: string;
    narration: string;
    reference: string;
    balance?: number;
  }>;
}

export interface PlaidAccountData {
  account_id: string;
  balances: {
    current: number | null;
    available: number | null;
    iso_currency_code: string | null;
  };
  mask: string | null;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
}

export interface PlaidTransactionData {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  authorized_date: string | null;
  name: string;
  merchant_name: string | null;
  payment_channel: string;
  pending: boolean;
  transaction_type: string;
  personal_finance_category?: { primary: string; detailed: string };
  iso_currency_code: string | null;
}

export interface BankSyncJobData {
  bankSyncJobId: string;
  organizationId: string;
  bankAccountId: string;
  connectionId?: string;
  consentId?: string;
  provider: string;
  isIncremental: boolean;
  fromDate?: string;
  toDate?: string;
}

export interface BankImportJobData {
  importId: string;
  organizationId: string;
  bankAccountId?: string;
  fileUrl: string;
  fileType: "CSV" | "EXCEL" | "PDF" | "OFX" | "MT940";
  columnMapping?: Record<string, string>;
}

export interface TransactionExportRow {
  date: string;
  narration: string;
  credit: string;
  debit: string;
  balance: string;
  referenceNumber: string;
  category: string;
  txnType: string;
  reconcileStatus: string;
  status: string;
}

export interface RiskCheckResult {
  riskType: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface InsightPayload {
  insightType: string;
  title: string;
  summary: string;
  detail?: string;
  data?: Record<string, unknown>;
  severity?: string;
  actionRequired?: boolean;
  actionLabel?: string;
  actionUrl?: string;
  validUntil?: Date;
}
