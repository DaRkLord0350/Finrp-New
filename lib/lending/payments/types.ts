// ============================================================
// FinRP — Loan Payment Rail provider abstraction
//
// Disbursing principal to a borrower and collecting EMIs via NACH /
// UPI AutoPay is a DIFFERENT real-world rail than lib/tbx/payments/
// (TBX's Payments API is scoped to Vendor bill-pay from the org's own
// TBX-linked corporate account — CreateBeneficiaryInput is typed
// around `vendorId`, not a generic counterparty). Rather than bending
// that vendor-shaped contract to fit a borrower, this is its own
// provider family, following the exact same pattern as lib/tbx/ and
// lib/tax/filing/ (interface → real HTTP client → mock → fail-fast
// config → cached factory).
//
// No NACH/UPI AutoPay gateway has published API documentation to this
// codebase (endpoint paths, auth flow, request/response schemas). Per
// the same explicit instruction lib/tbx honors, this module does not
// fabricate that contract: provider.ts implements the provider
// architecture, retry/backoff, and auth framework for real, but its
// endpoint-calling methods throw LoanPaymentEndpointNotBoundError
// until a real gateway is configured. mock-provider.ts implements the
// same interface with deterministic fake data so the disbursement /
// collection pipeline, ledger posting, and dashboards are fully real
// and testable today via LOAN_PAYMENT_MOCK_MODE.
// ============================================================

export type LoanPaymentOutcome = "SUCCESS" | "FAILED" | "PENDING";

export interface LoanPaymentDiagnostics {
  endpoint: string;
  httpMethod: string;
  statusCode: number;
  responseHeaders: Record<string, string>;
  durationMs: number;
  retryCount: number;
}

export interface LoanPaymentResultBase {
  outcome: LoanPaymentOutcome;
  raw: unknown;
  diagnostics?: LoanPaymentDiagnostics;
}

// ---------------------------------------------------------------------------
// Disbursement — one-time payout of principal to the borrower
// ---------------------------------------------------------------------------

export interface DisburseInput {
  organizationId: string;
  /** Our LoanDisbursement.id, sent as a client reference so a webhook can be matched back. */
  clientReference: string;
  beneficiaryName: string;
  beneficiaryAccountNumber: string;
  beneficiaryIfsc: string;
  amount: number;
  mode: "NEFT" | "RTGS" | "IMPS" | "UPI" | "CHEQUE";
  narration: string;
}

export interface DisburseResult extends LoanPaymentResultBase {
  paymentReferenceId?: string;
  status?: string;
  utrNumber?: string;
}

// ---------------------------------------------------------------------------
// Mandate — NACH / UPI AutoPay registration for recurring EMI auto-debit
// ---------------------------------------------------------------------------

export type MandateType = "NACH" | "UPI_AUTOPAY";

export interface RegisterMandateInput {
  organizationId: string;
  loanAccountId: string;
  mandateType: MandateType;
  payerName: string;
  payerAccountNumber?: string; // NACH
  payerIfsc?: string; // NACH
  payerVpa?: string; // UPI AutoPay
  maxAmountPerDebit: number;
  startDate: Date;
  endDate: Date;
}

export interface RegisterMandateResult extends LoanPaymentResultBase {
  mandateReferenceId?: string;
  status?: "PENDING" | "ACTIVE" | "REJECTED";
}

export interface CancelMandateInput {
  organizationId: string;
  mandateReferenceId: string;
}

export interface CancelMandateResult extends LoanPaymentResultBase {
  status?: "CANCELLED";
}

// ---------------------------------------------------------------------------
// Collection — trigger a single EMI debit against a registered mandate
// ---------------------------------------------------------------------------

export interface CollectViaMandateInput {
  organizationId: string;
  mandateReferenceId: string;
  /** Our LoanRepayment.id. */
  clientReference: string;
  amount: number;
  dueDate: Date;
}

export interface CollectViaMandateResult extends LoanPaymentResultBase {
  paymentReferenceId?: string;
  status?: string;
}

export interface FetchPaymentStatusInput {
  organizationId: string;
  paymentReferenceId: string;
}

export interface FetchPaymentStatusResult extends LoanPaymentResultBase {
  status?: "PROCESSING" | "SUCCESS" | "FAILED" | "BOUNCED";
  utrNumber?: string;
  failureReason?: string;
}

// ---------------------------------------------------------------------------
// Provider contract — implemented by both the real client and the mock
// ---------------------------------------------------------------------------

export interface LoanPaymentProvider {
  readonly name: "LOAN_PAYMENT_HTTP" | "LOAN_PAYMENT_MOCK";
  disburse(input: DisburseInput): Promise<DisburseResult>;
  registerMandate(input: RegisterMandateInput): Promise<RegisterMandateResult>;
  cancelMandate(input: CancelMandateInput): Promise<CancelMandateResult>;
  collectViaMandate(input: CollectViaMandateInput): Promise<CollectViaMandateResult>;
  fetchPaymentStatus(input: FetchPaymentStatusInput): Promise<FetchPaymentStatusResult>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class LoanPaymentProviderError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly retryable: boolean;
  readonly requestId?: string;

  constructor(opts: { message: string; status?: number | null; code?: string; retryable?: boolean; requestId?: string }) {
    super(opts.message);
    this.name = "LoanPaymentProviderError";
    this.status = opts.status ?? null;
    this.code = opts.code ?? "PROVIDER_ERROR";
    this.retryable = opts.retryable ?? false;
    this.requestId = opts.requestId;
  }
}

export class LoanPaymentNotConfiguredError extends LoanPaymentProviderError {
  constructor() {
    super({
      message:
        "No loan payment gateway is configured — set LOAN_PAYMENT_MOCK_MODE=true for development, " +
        "or configure real NACH/UPI AutoPay gateway credentials (LOAN_PAYMENT_BASE_URL / " +
        "LOAN_PAYMENT_CLIENT_ID / LOAN_PAYMENT_API_KEY).",
      code: "NOT_CONFIGURED",
    });
    this.name = "LoanPaymentNotConfiguredError";
  }
}

/**
 * Thrown by the real provider for any operation whose HTTP contract has not
 * been bound to a real gateway yet. Deliberately not retryable — retrying an
 * undocumented call cannot succeed by chance.
 */
export class LoanPaymentEndpointNotBoundError extends LoanPaymentProviderError {
  constructor(operation: string) {
    super({
      message:
        `Loan payment gateway — "${operation}" has no bound endpoint yet. Set LOAN_PAYMENT_MOCK_MODE=true ` +
        `for development, or bind this operation to a real NACH/UPI AutoPay gateway.`,
      code: "ENDPOINT_NOT_BOUND",
      retryable: false,
    });
    this.name = "LoanPaymentEndpointNotBoundError";
  }
}
