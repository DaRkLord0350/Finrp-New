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
