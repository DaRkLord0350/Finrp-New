// ============================================================
// FinRP — TBX Balance API types
//
// TBX has not published the Balance API's technical contract
// (endpoint paths, auth flow, request/response schemas) to this
// codebase — only a product overview (TBX Product Deck) confirming
// the Corporate Internet Banking module exposes Balance APIs. Per
// explicit instruction, this module does not fabricate that
// contract: balance.client.ts implements the provider architecture
// and authentication framework for real, but its endpoint-calling
// methods are pending stubs (see TbxEndpointNotBoundError) until
// TBX publishes real API documentation.
//
// balance.mock.ts implements the same TbxBalanceProvider interface
// with deterministic fake data so the rest of the pipeline
// (persistence, dashboard, background sync) is fully real and
// testable today via TBX_BANKING_MOCK_MODE.
// ============================================================

export type TbxBalanceOutcome = "SUCCESS" | "FAILED";

export interface FetchBalancesInput {
  organizationId: string;
  bankAccountId: string;
  /** TBX-side account reference, once a real linkage exists (BankConnection/BankAccount). */
  tbxAccountRef?: string;
}

export interface FetchBalancesResult {
  outcome: TbxBalanceOutcome;
  currentBalance?: number;
  availableBalance?: number;
  ledgerBalance?: number;
  currency?: string;
  /** When TBX says the balance was last updated on their side. */
  asOf?: Date;
  /** Raw provider response, kept for audit storage. */
  raw: unknown;
  diagnostics?: {
    endpoint: string;
    httpMethod: string;
    statusCode: number;
    responseHeaders: Record<string, string>;
    durationMs: number;
    retryCount: number;
  };
}

// ---------------------------------------------------------------------------
// Provider contract — implemented by both the real client and the mock
// ---------------------------------------------------------------------------

export interface TbxBalanceProvider {
  readonly name: "TBX_BALANCE_HTTP" | "TBX_BALANCE_MOCK";
  fetchBalances(input: FetchBalancesInput): Promise<FetchBalancesResult>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class TbxBalanceProviderError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly retryable: boolean;
  readonly requestId?: string;

  constructor(opts: {
    message: string;
    status?: number | null;
    code?: string;
    retryable?: boolean;
    requestId?: string;
  }) {
    super(opts.message);
    this.name = "TbxBalanceProviderError";
    this.status = opts.status ?? null;
    this.code = opts.code ?? "PROVIDER_ERROR";
    this.retryable = opts.retryable ?? false;
    this.requestId = opts.requestId;
  }
}

export class TbxBalanceNotConfiguredError extends TbxBalanceProviderError {
  constructor() {
    super({
      message:
        "TBX Balance API is not configured — no TBX_BANKING_BASE_URL/credentials are set and " +
        "TBX_BANKING_MOCK_MODE is not enabled. Set TBX_BANKING_MOCK_MODE=true for development, " +
        "or configure real TBX Corporate Internet Banking credentials.",
      code: "NOT_CONFIGURED",
    });
    this.name = "TbxBalanceNotConfiguredError";
  }
}

/**
 * Thrown by the real provider for any operation whose HTTP contract TBX has
 * not documented yet (including OAuth token acquisition). Deliberately not
 * retryable — retrying an undocumented call cannot succeed by chance. This
 * is the one thing the real client refuses to guess; everything else in the
 * provider/auth framework around it is fully implemented.
 */
export class TbxEndpointNotBoundError extends TbxBalanceProviderError {
  constructor(operation: string) {
    super({
      message:
        `TBX Balance API — "${operation}" has no confirmed endpoint contract yet. ` +
        `TBX has not published official Balance API documentation (URL, auth flow, request/response ` +
        `schema) to this codebase. Set TBX_BANKING_MOCK_MODE=true for development, or bind this ` +
        `operation to the real TBX endpoint once documentation is available.`,
      code: "ENDPOINT_NOT_BOUND",
      retryable: false,
    });
    this.name = "TbxEndpointNotBoundError";
  }
}
