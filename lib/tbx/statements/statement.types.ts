// ============================================================
// FinRP — TBX Statement API types
//
// Same "no fabricated endpoints" discipline as lib/tbx/balance/:
// TBX has not published the Statement API's technical contract, so
// statement.client.ts implements the provider architecture and
// authentication framework for real, but the endpoint-calling
// method throws TbxEndpointNotBoundError rather than guessing a
// URL/request/response shape. statement.mock.ts implements the same
// TbxStatementProvider interface with deterministic fake statement
// lines so the rest of the pipeline (parsing, categorization, ledger
// posting, persistence) is fully real and testable today.
// ============================================================

export type TbxStatementOutcome = "SUCCESS" | "FAILED";

export interface FetchStatementInput {
  organizationId: string;
  bankAccountId: string;
  fromDate: Date;
  toDate: Date;
  /** TBX-side account reference, once a real linkage exists. */
  tbxAccountRef?: string;
}

/**
 * One raw statement line as returned by TBX, in whatever shape the
 * provider normalizes it to. The mock provider's shape here is a
 * reasonable placeholder for "a bank statement line" (date, amount,
 * debit/credit, balance, narration, reference, UTR, mode) — not a
 * guess at TBX's actual wire format, which is unknown.
 */
export interface RawStatementLine {
  externalTxnId: string;
  transactionDate: string; // ISO date
  valueDate?: string;
  narration: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  balanceAfter?: number;
  referenceNumber?: string;
  utr?: string;
  mode?: string; // "NEFT" | "RTGS" | "IMPS" | "UPI" | "CHEQUE" | ...
}

export interface FetchStatementResult {
  outcome: TbxStatementOutcome;
  lines: RawStatementLine[];
  /** Raw provider response, stored verbatim in RawBankStatement.rawJson. */
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

export interface TbxStatementProvider {
  readonly name: "TBX_STATEMENT_HTTP" | "TBX_STATEMENT_MOCK";
  fetchStatement(input: FetchStatementInput): Promise<FetchStatementResult>;
}

// ---------------------------------------------------------------------------
// Errors — mirrors lib/tbx/balance/balance.types.ts exactly
// ---------------------------------------------------------------------------

export class TbxStatementProviderError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly retryable: boolean;
  readonly requestId?: string;

  constructor(opts: { message: string; status?: number | null; code?: string; retryable?: boolean; requestId?: string }) {
    super(opts.message);
    this.name = "TbxStatementProviderError";
    this.status = opts.status ?? null;
    this.code = opts.code ?? "PROVIDER_ERROR";
    this.retryable = opts.retryable ?? false;
    this.requestId = opts.requestId;
  }
}

export class TbxStatementNotConfiguredError extends TbxStatementProviderError {
  constructor() {
    super({
      message:
        "TBX Statement API is not configured — no TBX_BANKING_BASE_URL/credentials are set and " +
        "TBX_BANKING_MOCK_MODE is not enabled. Set TBX_BANKING_MOCK_MODE=true for development, " +
        "or configure real TBX Corporate Internet Banking credentials.",
      code: "NOT_CONFIGURED",
    });
    this.name = "TbxStatementNotConfiguredError";
  }
}

/**
 * Thrown by the real provider for any operation whose HTTP contract TBX has
 * not documented yet. Not retryable — see lib/tbx/balance/balance.types.ts's
 * TbxEndpointNotBoundError for the identical rationale.
 */
export class TbxStatementEndpointNotBoundError extends TbxStatementProviderError {
  constructor(operation: string) {
    super({
      message:
        `TBX Statement API — "${operation}" has no confirmed endpoint contract yet. ` +
        `TBX has not published official Statement API documentation (URL, auth flow, request/response ` +
        `schema) to this codebase. Set TBX_BANKING_MOCK_MODE=true for development, or bind this ` +
        `operation to the real TBX endpoint once documentation is available.`,
      code: "ENDPOINT_NOT_BOUND",
      retryable: false,
    });
    this.name = "TbxStatementEndpointNotBoundError";
  }
}
