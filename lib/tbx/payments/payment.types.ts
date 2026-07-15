// ============================================================
// FinRP — TBX Payment API types
//
// TBX has not published the Payments API's technical contract
// (endpoint paths, auth flow, request/response schemas, webhook
// payload shape) to this codebase — only a product overview
// confirming the Corporate Internet Banking module exposes Payment
// APIs with Maker-Checker workflows. Per explicit instruction, this
// module does not fabricate that contract: payment.client.ts
// implements the provider architecture and authentication
// framework for real, but its endpoint-calling methods are pending
// stubs (see TbxPaymentEndpointNotBoundError) until TBX publishes
// real API documentation.
//
// Webhook *signature verification* (payment.webhook.ts) is a
// different kind of gap: HMAC-over-shared-secret is an industry
// standard mechanism (this codebase already does the same thing for
// Razorpay in lib/billing/razorpay.ts), not a TBX-specific contract
// detail, so it IS implemented for real — only the exact header
// name is a placeholder pending TBX's docs (clearly marked).
//
// payment.mock.ts implements the same TbxPaymentProvider interface
// with deterministic fake data so the rest of the pipeline (Maker-
// Checker state machine, ledger posting, dashboard) is fully real
// and testable today via TBX_BANKING_MOCK_MODE.
// ============================================================

export type TbxPaymentOutcome = "SUCCESS" | "FAILED";

export interface InitiatePaymentInput {
  organizationId: string;
  /** Our VendorPayment.id, passed to TBX as a client/merchant reference so the webhook can be matched back without relying solely on tbxPaymentId. */
  clientReference: string;
  beneficiaryTbxId: string;
  amount: number;
  paymentType: "NEFT" | "RTGS" | "IMPS" | "BULK" | "SCHEDULED";
  narration: string;
  scheduledFor?: Date;
}

export interface InitiatePaymentResult {
  outcome: TbxPaymentOutcome;
  tbxPaymentId?: string;
  /** Raw status string as reported by TBX at submission time, e.g. "PROCESSING". */
  status?: string;
  raw: unknown;
  diagnostics?: TbxPaymentDiagnostics;
}

export interface FetchPaymentStatusInput {
  organizationId: string;
  tbxPaymentId: string;
}

export interface FetchPaymentStatusResult {
  outcome: TbxPaymentOutcome;
  status?: "PROCESSING" | "SUCCESS" | "FAILED";
  utr?: string;
  failureReason?: string;
  raw: unknown;
  diagnostics?: TbxPaymentDiagnostics;
}

export interface TbxPaymentDiagnostics {
  endpoint: string;
  httpMethod: string;
  statusCode: number;
  responseHeaders: Record<string, string>;
  durationMs: number;
  retryCount: number;
}

// ---------------------------------------------------------------------------
// Provider contract — implemented by both the real client and the mock
// ---------------------------------------------------------------------------

export interface TbxPaymentProvider {
  readonly name: "TBX_PAYMENT_HTTP" | "TBX_PAYMENT_MOCK";
  initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
  fetchPaymentStatus(input: FetchPaymentStatusInput): Promise<FetchPaymentStatusResult>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class TbxPaymentProviderError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly retryable: boolean;
  readonly requestId?: string;

  constructor(opts: { message: string; status?: number | null; code?: string; retryable?: boolean; requestId?: string }) {
    super(opts.message);
    this.name = "TbxPaymentProviderError";
    this.status = opts.status ?? null;
    this.code = opts.code ?? "PROVIDER_ERROR";
    this.retryable = opts.retryable ?? false;
    this.requestId = opts.requestId;
  }
}

export class TbxPaymentNotConfiguredError extends TbxPaymentProviderError {
  constructor() {
    super({
      message:
        "TBX Payment API is not configured — no TBX_BANKING_BASE_URL/credentials are set and " +
        "TBX_BANKING_MOCK_MODE is not enabled. Set TBX_BANKING_MOCK_MODE=true for development, " +
        "or configure real TBX Corporate Internet Banking credentials.",
      code: "NOT_CONFIGURED",
    });
    this.name = "TbxPaymentNotConfiguredError";
  }
}

/**
 * Thrown by the real provider for any operation whose HTTP contract TBX has
 * not documented yet (including OAuth token acquisition). Deliberately not
 * retryable — retrying an undocumented call cannot succeed by chance.
 */
export class TbxPaymentEndpointNotBoundError extends TbxPaymentProviderError {
  constructor(operation: string) {
    super({
      message:
        `TBX Payment API — "${operation}" has no confirmed endpoint contract yet. ` +
        `TBX has not published official Payments API documentation (URL, auth flow, request/response ` +
        `schema) to this codebase. Set TBX_BANKING_MOCK_MODE=true for development, or bind this ` +
        `operation to the real TBX endpoint once documentation is available.`,
      code: "ENDPOINT_NOT_BOUND",
      retryable: false,
    });
    this.name = "TbxPaymentEndpointNotBoundError";
  }
}

/** Thrown when a checker attempts to approve their own payment request. */
export class SameActorApprovalError extends Error {
  constructor() {
    super("A payment cannot be approved by the same user who created it — Maker and Checker must be different users.");
    this.name = "SameActorApprovalError";
  }
}

/** Thrown on an invalid VendorPayment state transition. */
export class InvalidPaymentStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPaymentStateError";
  }
}
