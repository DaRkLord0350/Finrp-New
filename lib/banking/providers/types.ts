// ============================================================
// FinRP Banking OS — BankingProvider Abstraction
// Pluggable provider interface so Setu AA, future AAs (Finbox,
// OneMoney) and direct bank APIs share one contract. Providers
// are pure API clients: they talk HTTP and normalize payloads.
// Persistence lives in lib/banking/sync-service.ts.
// ============================================================

import type { AAProvider } from "@prisma/client";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface CreateConsentInput {
  organizationId: string;
  /** Customer mobile or full VUA (e.g. "9999999999@onemoney"). Optional —
   *  when omitted the user enters it on the provider's hosted consent page. */
  vua?: string;
  /** Where the provider redirects the user after approve/reject. */
  redirectUrl: string;
  /** FI data window requested. Defaults to provider configuration. */
  dataRange?: { from: Date; to: Date };
  /** Free-form context tags forwarded to the provider. */
  context?: Array<{ key: string; value: string }>;
}

export interface DataSessionInput {
  /** Provider-side consent id (BankConsent.consentId). */
  consentId: string;
  dataRange: { from: Date; to: Date };
}

// ---------------------------------------------------------------------------
// Normalized outputs
// ---------------------------------------------------------------------------

export interface ConsentResult {
  /** Provider-side consent id. */
  consentId: string;
  /** Hosted consent-approval URL to redirect the customer to. */
  redirectUrl: string;
  status: string;
  /** Raw provider response for audit storage. */
  raw: unknown;
}

export interface ConsentStatusResult {
  consentId: string;
  status: "PENDING" | "ACTIVE" | "REJECTED" | "REVOKED" | "PAUSED" | "EXPIRED";
  /** Accounts the user linked during approval, when the provider reports them. */
  linkedAccounts: DiscoveredAccount[];
  raw: unknown;
}

export interface DiscoveredAccount {
  /** Provider link reference — stable id for the linked account. */
  linkRefNumber: string;
  maskedAccNumber: string;
  fiType: string; // DEPOSIT, RECURRING_DEPOSIT, TERM_DEPOSIT...
  accountType?: string; // SAVINGS / CURRENT
  fipId?: string; // bank identifier
  fipName?: string;
}

export interface NormalizedBalance {
  linkRefNumber: string;
  maskedAccNumber: string;
  currentBalance: number;
  availableBalance?: number;
  currency: string;
  balanceDate: Date;
}

export interface NormalizedTransaction {
  /** Provider transaction id — dedup key. */
  externalId: string;
  linkRefNumber: string;
  maskedAccNumber: string;
  type: "CREDIT" | "DEBIT";
  mode: string;
  amount: number;
  balanceAfter?: number;
  transactionDate: Date;
  valueDate?: Date;
  narration: string;
  reference?: string;
}

export interface FIDataResult {
  sessionId: string;
  status: "PENDING" | "COMPLETED" | "PARTIAL" | "FAILED" | "EXPIRED";
  accounts: DiscoveredAccount[];
  balances: NormalizedBalance[];
  transactions: NormalizedTransaction[];
  raw: unknown;
}

export interface WebhookVerification {
  valid: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Provider contract
// ---------------------------------------------------------------------------

export interface BankingProvider {
  readonly name: AAProvider;

  /** Full connect entry point: creates a consent and returns the hosted
   *  approval URL. Equivalent to createConsent for AA providers; direct
   *  bank-API providers may implement OAuth here instead. */
  connectBank(input: CreateConsentInput): Promise<ConsentResult>;

  /** Create a data-sharing consent with the provider. */
  createConsent(input: CreateConsentInput): Promise<ConsentResult>;

  /** Poll the provider for current consent status + linked accounts. */
  getConsentStatus(consentId: string): Promise<ConsentStatusResult>;

  /** Revoke an active consent at the provider. */
  revokeConsent(consentId: string): Promise<void>;

  /** Create an FI data session for a consent (request data from banks). */
  createDataSession(input: DataSessionInput): Promise<{ sessionId: string; status: string }>;

  /** Fetch a data session's payload (poll until COMPLETED/PARTIAL). */
  fetchSessionData(sessionId: string): Promise<FIDataResult>;

  /** Discover accounts linked under a consent (runs/reuses a data session). */
  fetchAccounts(input: DataSessionInput): Promise<DiscoveredAccount[]>;

  /** Latest balances for the accounts under a consent. */
  fetchBalances(input: DataSessionInput): Promise<NormalizedBalance[]>;

  /** Transactions for the accounts under a consent in the given range. */
  fetchTransactions(input: DataSessionInput): Promise<NormalizedTransaction[]>;

  /** Full refresh: session → poll → parsed accounts + balances + txns. */
  refreshData(input: DataSessionInput): Promise<FIDataResult>;

  /** Alias of refreshData scoped to a single account (AA sessions always
   *  return all linked accounts; callers filter by linkRefNumber). */
  syncAccount(input: DataSessionInput & { linkRefNumber?: string }): Promise<FIDataResult>;

  /** Revoke consent + invalidate provider-side links. */
  disconnectBank(consentId: string): Promise<void>;

  /** Verify a webhook signature against the raw request body. */
  verifyWebhook(rawBody: string, signature: string | null): WebhookVerification;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class BankingProviderError extends Error {
  readonly provider: string;
  readonly status: number | null;
  readonly code: string;
  readonly retryable: boolean;
  readonly requestId?: string;

  constructor(opts: {
    provider: string;
    message: string;
    status?: number | null;
    code?: string;
    retryable?: boolean;
    requestId?: string;
  }) {
    super(opts.message);
    this.name = "BankingProviderError";
    this.provider = opts.provider;
    this.status = opts.status ?? null;
    this.code = opts.code ?? "PROVIDER_ERROR";
    this.retryable = opts.retryable ?? false;
    this.requestId = opts.requestId;
  }
}
