// ============================================================
// FinRP — Credit Bureau provider abstraction (Phase 3, Module 2)
//
// One CreditProvider interface, one adapter per bureau (Experian,
// CIBIL, CRIF, Equifax), mirroring lib/tbx/'s pattern exactly: a real
// HTTP client per bureau + a deterministic mock, selected via that
// bureau's own *_MOCK_MODE env flag.
//
// None of the four bureaus' real API contracts (endpoint paths, auth
// flow, request/response schemas) have been provided to this
// codebase. Per the same explicit instruction lib/tbx and
// lib/lending/payments honor, this module does not fabricate those
// contracts: each provider's real HTTP client implements the
// architecture (auth, timeout, retry/backoff, structured logging) for
// real, but throws CreditEndpointNotBoundError until bound to a real,
// documented bureau endpoint. The mock implementations make the full
// pull → score → tradelines → risk pipeline fully real and testable
// today via <BUREAU>_MOCK_MODE=true.
// ============================================================

export type CreditPullOutcome = "SUCCESS" | "FAILED";
export type CreditPullType = "SOFT" | "HARD";

export interface CreditDiagnostics {
  endpoint: string;
  httpMethod: string;
  statusCode: number;
  responseHeaders: Record<string, string>;
  durationMs: number;
  retryCount: number;
}

export interface PullCreditReportInput {
  organizationId: string;
  subjectName: string;
  pan?: string;
  dob?: string; // YYYY-MM-DD
  mobileNumber?: string;
  address?: string;
  pullType: CreditPullType;
  /** Idempotency / correlation reference passed to the bureau where supported. */
  clientReference: string;
}

export interface CreditTradelineData {
  lenderName: string;
  accountType: string;
  accountNumber?: string;
  ownership: "INDIVIDUAL" | "JOINT" | "GUARANTOR" | "AUTHORIZED_USER";
  status: "ACTIVE" | "CLOSED" | "DEFAULT" | "WRITTEN_OFF" | "SETTLED" | "RESTRUCTURED";
  sanctionedAmount?: number;
  currentBalance?: number;
  overdueAmount?: number;
  dpd: number;
  openedDate?: string;
  closedDate?: string;
  lastReportedDate?: string;
}

export interface CreditEnquiryData {
  enquiringInstitution: string;
  enquiryPurpose?: string;
  enquiryDate: string;
  amount?: number;
}

export interface PullCreditReportResult {
  outcome: CreditPullOutcome;
  referenceId?: string;
  score?: number;
  scoreModel?: string;
  scoreDate?: string;
  tradelines: CreditTradelineData[];
  enquiries: CreditEnquiryData[];
  raw: unknown;
  diagnostics?: CreditDiagnostics;
  failureReason?: string;
}

export interface CreditProvider {
  readonly name: string;
  readonly bureau: "EXPERIAN" | "CIBIL" | "CRIF" | "EQUIFAX";
  pullReport(input: PullCreditReportInput): Promise<PullCreditReportResult>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CreditProviderError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly retryable: boolean;
  readonly requestId?: string;

  constructor(opts: { message: string; status?: number | null; code?: string; retryable?: boolean; requestId?: string }) {
    super(opts.message);
    this.name = "CreditProviderError";
    this.status = opts.status ?? null;
    this.code = opts.code ?? "PROVIDER_ERROR";
    this.retryable = opts.retryable ?? false;
    this.requestId = opts.requestId;
  }
}

export class CreditNotConfiguredError extends CreditProviderError {
  constructor(bureau: string) {
    super({
      message:
        `No credentials configured for ${bureau} — set ${bureau}_MOCK_MODE=true for development, ` +
        `or configure real ${bureau} credentials (${bureau}_BASE_URL / ${bureau}_CLIENT_ID / ${bureau}_API_KEY).`,
      code: "NOT_CONFIGURED",
    });
    this.name = "CreditNotConfiguredError";
  }
}

/**
 * Thrown by a real bureau provider for any operation whose HTTP contract
 * has not been bound yet. Deliberately not retryable — retrying an
 * undocumented call cannot succeed by chance.
 */
export class CreditEndpointNotBoundError extends CreditProviderError {
  constructor(bureau: string, operation: string) {
    super({
      message:
        `${bureau} — "${operation}" has no bound endpoint yet. ${bureau} has not published (or this codebase ` +
        `has not been given) official API documentation. Set ${bureau}_MOCK_MODE=true for development, or bind ` +
        `this operation to ${bureau}'s real, documented endpoint.`,
      code: "ENDPOINT_NOT_BOUND",
      retryable: false,
    });
    this.name = "CreditEndpointNotBoundError";
  }
}
