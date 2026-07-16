// ============================================================
// lib/verification/identity-document/types.ts
//
// Driving License / Passport / Voter ID verification requires a
// government-database-backed vendor (e.g. Karza, Signzy, IDfy —
// none contracted here). Same real-client + fail-loud-until-bound
// pattern as lib/fraud/ip-intelligence and lib/aml/negative-media.
// ============================================================

export type IdentityDocumentType = "DRIVING_LICENSE" | "PASSPORT" | "VOTER_ID";

export interface IdentityDocumentInput {
  documentType: IdentityDocumentType;
  documentNumber: string;
  nameToMatch?: string;
  dob?: string; // YYYY-MM-DD, required by most DL/passport vendor contracts
}

export interface IdentityDocumentResult {
  outcome: "VERIFIED" | "FAILED" | "PENDING";
  registeredName?: string;
  nameMatchScore?: number; // 0-100
  status?: string; // vendor-specific, e.g. "VALID" | "EXPIRED" | "NOT_FOUND"
  raw: unknown;
  failureReason?: string;
}

export interface IdentityDocumentProvider {
  readonly name: string;
  verify(input: IdentityDocumentInput): Promise<IdentityDocumentResult>;
}

export class IdentityDocumentProviderError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly retryable: boolean;
  constructor(opts: { message: string; status?: number | null; code?: string; retryable?: boolean }) {
    super(opts.message);
    this.name = "IdentityDocumentProviderError";
    this.status = opts.status ?? null;
    this.code = opts.code ?? "PROVIDER_ERROR";
    this.retryable = opts.retryable ?? false;
  }
}

export class IdentityDocumentNotConfiguredError extends IdentityDocumentProviderError {
  constructor() {
    super({
      message:
        "No identity-document verification vendor configured — set IDENTITY_DOCUMENT_MOCK_MODE=true for development, or configure real vendor credentials (IDENTITY_DOCUMENT_BASE_URL / IDENTITY_DOCUMENT_API_KEY).",
      code: "NOT_CONFIGURED",
    });
    this.name = "IdentityDocumentNotConfiguredError";
  }
}

export class IdentityDocumentEndpointNotBoundError extends IdentityDocumentProviderError {
  constructor(operation: string) {
    super({
      message: `Identity-document provider — "${operation}" has no bound endpoint yet. No vendor contract has been provided to this codebase. Set IDENTITY_DOCUMENT_MOCK_MODE=true for development, or bind this operation to a real vendor's documented endpoint.`,
      code: "ENDPOINT_NOT_BOUND",
      retryable: false,
    });
    this.name = "IdentityDocumentEndpointNotBoundError";
  }
}
