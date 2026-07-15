// ============================================================
// FinRP — TBX Beneficiary API types
//
// TBX has not published the Beneficiary Management API's technical
// contract (endpoint paths, auth flow, request/response schemas) to
// this codebase — only a product overview confirming the Corporate
// Internet Banking module exposes Beneficiary Management APIs. Per
// explicit instruction, this module does not fabricate that
// contract: beneficiary.client.ts implements the provider
// architecture and authentication framework for real, but its
// endpoint-calling methods are pending stubs (see
// TbxBeneficiaryEndpointNotBoundError) until TBX publishes real API
// documentation.
//
// beneficiary.mock.ts implements the same TbxBeneficiaryProvider
// interface with deterministic fake data so the rest of the
// pipeline (Vendor persistence, UI, background sync) is fully real
// and testable today via TBX_BANKING_MOCK_MODE.
//
// Vendor is the source of truth for beneficiary state — there is no
// separate beneficiary master table (see prisma/schema.prisma
// Vendor.tbxBeneficiaryId and friends).
// ============================================================

export type TbxBeneficiaryOutcome = "SUCCESS" | "FAILED";

export interface CreateBeneficiaryInput {
  organizationId: string;
  vendorId: string;
  beneficiaryName: string;
  accountNumber: string;
  ifscCode: string;
  bankName?: string;
}

export interface CreateBeneficiaryResult {
  outcome: TbxBeneficiaryOutcome;
  tbxBeneficiaryId?: string;
  /** Raw status string as reported by TBX at creation time, e.g. "PENDING". */
  status?: string;
  raw: unknown;
  diagnostics?: TbxBeneficiaryDiagnostics;
}

export interface VerifyBeneficiaryInput {
  organizationId: string;
  vendorId: string;
  tbxBeneficiaryId: string;
}

export interface VerifyBeneficiaryResult {
  outcome: TbxBeneficiaryOutcome;
  verificationStatus?: "VERIFIED" | "FAILED" | "IN_PROGRESS" | "PENDING";
  verifiedAccountHolderName?: string;
  /** 0-100 name-match confidence, when TBX reports one. */
  nameMatchScore?: number;
  raw: unknown;
  diagnostics?: TbxBeneficiaryDiagnostics;
}

export interface FetchBeneficiaryStatusInput {
  organizationId: string;
  vendorId: string;
  tbxBeneficiaryId: string;
}

export interface FetchBeneficiaryStatusResult {
  outcome: TbxBeneficiaryOutcome;
  beneficiaryStatus?: "PENDING" | "ACTIVE" | "INACTIVE" | "FAILED";
  verificationStatus?: "NOT_STARTED" | "PENDING" | "IN_PROGRESS" | "VERIFIED" | "FAILED" | "EXPIRED";
  approvalStatus?: "NOT_REQUESTED" | "PENDING" | "APPROVED" | "REJECTED";
  raw: unknown;
  diagnostics?: TbxBeneficiaryDiagnostics;
}

export interface TbxBeneficiaryDiagnostics {
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

export interface TbxBeneficiaryProvider {
  readonly name: "TBX_BENEFICIARY_HTTP" | "TBX_BENEFICIARY_MOCK";
  createBeneficiary(input: CreateBeneficiaryInput): Promise<CreateBeneficiaryResult>;
  verifyBeneficiary(input: VerifyBeneficiaryInput): Promise<VerifyBeneficiaryResult>;
  fetchBeneficiaryStatus(input: FetchBeneficiaryStatusInput): Promise<FetchBeneficiaryStatusResult>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class TbxBeneficiaryProviderError extends Error {
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
    this.name = "TbxBeneficiaryProviderError";
    this.status = opts.status ?? null;
    this.code = opts.code ?? "PROVIDER_ERROR";
    this.retryable = opts.retryable ?? false;
    this.requestId = opts.requestId;
  }
}

export class TbxBeneficiaryNotConfiguredError extends TbxBeneficiaryProviderError {
  constructor() {
    super({
      message:
        "TBX Beneficiary API is not configured — no TBX_BANKING_BASE_URL/credentials are set and " +
        "TBX_BANKING_MOCK_MODE is not enabled. Set TBX_BANKING_MOCK_MODE=true for development, " +
        "or configure real TBX Corporate Internet Banking credentials.",
      code: "NOT_CONFIGURED",
    });
    this.name = "TbxBeneficiaryNotConfiguredError";
  }
}

/**
 * Thrown by the real provider for any operation whose HTTP contract TBX has
 * not documented yet (including OAuth token acquisition). Deliberately not
 * retryable — retrying an undocumented call cannot succeed by chance.
 */
export class TbxBeneficiaryEndpointNotBoundError extends TbxBeneficiaryProviderError {
  constructor(operation: string) {
    super({
      message:
        `TBX Beneficiary API — "${operation}" has no confirmed endpoint contract yet. ` +
        `TBX has not published official Beneficiary Management API documentation (URL, auth flow, ` +
        `request/response schema) to this codebase. Set TBX_BANKING_MOCK_MODE=true for development, ` +
        `or bind this operation to the real TBX endpoint once documentation is available.`,
      code: "ENDPOINT_NOT_BOUND",
      retryable: false,
    });
    this.name = "TbxBeneficiaryEndpointNotBoundError";
  }
}
