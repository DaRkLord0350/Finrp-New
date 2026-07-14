// ============================================================
// FinRP — TBX (TransBnk) Provider Abstraction
//
// TBX's actual API contract (endpoints, auth, request/response
// schemas) is NOT documented anywhere available to this codebase —
// only a product catalog of API *names* exists (TBX Validation
// APIs.xlsx) and a marketing overview of the onboarding journey
// (TBX Product Deck). This interface captures the SHAPE Phase 1
// needs; lib/tbx/provider.ts's HTTP bodies are placeholders until
// real API docs are available (see docs/TBX_FOUNDATION.md §14).
//
// Mirrors lib/banking/providers/types.ts's provider-abstraction
// pattern: providers are pure API clients (HTTP + normalization),
// persistence/orchestration lives in lib/tbx/service.ts.
// ============================================================

// ---------------------------------------------------------------------------
// Common result shape
// ---------------------------------------------------------------------------

export type TbxVerificationOutcome = "VERIFIED" | "FAILED" | "PENDING";

export interface TbxResultBase {
  outcome: TbxVerificationOutcome;
  /** TBX's own reference id for this specific verification call, if any. */
  referenceId?: string;
  /** Raw provider response, kept for audit storage (redacted before persisting). */
  raw: unknown;
  /** HTTP diagnostics from the underlying call — populated by TbxHttpProvider,
   *  absent from MockTbxProvider. Read by lib/tbx/service.ts to write the
   *  Module 8 TbxApiLog row with real status/headers/duration/retry data. */
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
// PAN
// ---------------------------------------------------------------------------

export interface VerifyPanInput {
  pan: string;
  /** When provided, TBX cross-checks the registered name against this. */
  nameToMatch?: string;
}

export interface VerifyPanResult extends TbxResultBase {
  registeredName?: string;
  nameMatchScore?: number; // 0-100
  panStatus?: string; // e.g. "ACTIVE", "INOPERATIVE"
  panType?: string; // Individual / Company / Firm / ...
}

// ---------------------------------------------------------------------------
// GSTIN
// ---------------------------------------------------------------------------

export interface VerifyGstinInput {
  gstin: string;
}

export interface VerifyGstinResult extends TbxResultBase {
  legalName?: string;
  tradeName?: string;
  gstinStatus?: string; // "Active" | "Cancelled" | ...
  registrationDate?: string;
  natureOfBusiness?: string[];
}

// ---------------------------------------------------------------------------
// CIN (company registration)
// ---------------------------------------------------------------------------

export interface VerifyCinInput {
  cin: string;
}

export interface VerifyCinResult extends TbxResultBase {
  companyName?: string;
  companyStatus?: string;
  incorporationDate?: string;
  companyType?: string;
}

// ---------------------------------------------------------------------------
// Aadhaar (offline / paperless OKYC — no raw Aadhaar number ever handled)
// ---------------------------------------------------------------------------

export interface VerifyAadhaarInput {
  /** Base64 of the UIDAI-issued offline-KYC XML (never the raw Aadhaar number). */
  offlineXmlBase64: string;
  /** UIDAI share-code used to decrypt the XML. */
  shareCode: string;
}

export interface VerifyAadhaarResult extends TbxResultBase {
  name?: string;
  dob?: string;
  gender?: string;
  address?: string;
  /** Last 4 digits only — the full number is never returned by this layer. */
  aadhaarLast4?: string;
}

// ---------------------------------------------------------------------------
// Bank account verification (Module 6)
// ---------------------------------------------------------------------------

export type BankVerificationMethod = "PENNY_DROP" | "PENNILESS_BAV";

export interface VerifyBankAccountInput {
  accountNumber: string;
  ifsc: string;
  method: BankVerificationMethod;
  nameToMatch?: string;
}

export interface VerifyBankAccountResult extends TbxResultBase {
  verifiedAccountHolderName?: string;
  nameMatchScore?: number; // 0-100
  bankName?: string;
  branchName?: string;
}

// ---------------------------------------------------------------------------
// Director / DIN lookup (Module 5)
// ---------------------------------------------------------------------------

export interface FetchDirectorInput {
  din: string;
}

export interface FetchDirectorResult extends TbxResultBase {
  name?: string;
  status?: string; // "Approved" | "Disqualified" | ...
  associatedCompanies?: string[];
}

// ---------------------------------------------------------------------------
// CKYC (Module 7 — Compliance & Risk)
// ---------------------------------------------------------------------------

export interface FetchCkycInput {
  pan?: string;
  ckycNumber?: string;
}

export interface FetchCkycResult extends TbxResultBase {
  ckycNumber?: string;
  found: boolean;
  name?: string;
}

// ---------------------------------------------------------------------------
// AML / PEP screening (Module 5 + 7)
// ---------------------------------------------------------------------------

export interface ScreenAmlPepInput {
  name: string;
  pan?: string;
  dob?: string;
}

export interface ScreenAmlPepResult extends TbxResultBase {
  isMatch: boolean;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";
  matches?: Array<{ list: string; matchedName: string; score: number }>;
}

// ---------------------------------------------------------------------------
// TBX Customer creation (Module 2 step 10 — registers the org's KYC/identity
// profile with TBX; deliberately NOT assumed to provision any account/payment
// capability — that is explicitly out of Phase 1 scope)
// ---------------------------------------------------------------------------

export interface CreateTbxCustomerInput {
  organizationId: string;
  legalName: string;
  pan?: string;
  gstin?: string;
  cin?: string;
  email?: string;
  phone?: string;
}

export interface CreateTbxCustomerResult extends TbxResultBase {
  tbxCustomerId: string;
  tbxOrganizationId?: string;
  tbxStatus?: string;
}

// ---------------------------------------------------------------------------
// Provider contract
// ---------------------------------------------------------------------------

export interface TbxProvider {
  readonly name: "TBX_HTTP" | "TBX_MOCK";

  verifyPan(input: VerifyPanInput): Promise<VerifyPanResult>;
  verifyGstin(input: VerifyGstinInput): Promise<VerifyGstinResult>;
  verifyCin(input: VerifyCinInput): Promise<VerifyCinResult>;
  verifyAadhaar(input: VerifyAadhaarInput): Promise<VerifyAadhaarResult>;
  verifyBankAccount(input: VerifyBankAccountInput): Promise<VerifyBankAccountResult>;
  fetchDirector(input: FetchDirectorInput): Promise<FetchDirectorResult>;
  fetchCkyc(input: FetchCkycInput): Promise<FetchCkycResult>;
  screenAmlPep(input: ScreenAmlPepInput): Promise<ScreenAmlPepResult>;
  createCustomer(input: CreateTbxCustomerInput): Promise<CreateTbxCustomerResult>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class TbxProviderError extends Error {
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
    this.name = "TbxProviderError";
    this.status = opts.status ?? null;
    this.code = opts.code ?? "PROVIDER_ERROR";
    this.retryable = opts.retryable ?? false;
    this.requestId = opts.requestId;
  }
}

export class TbxNotConfiguredError extends TbxProviderError {
  constructor() {
    super({
      message:
        "TBX is not configured — no TBX_BASE_URL/credentials are set and TBX_MOCK_MODE is not enabled. " +
        "Set TBX_MOCK_MODE=true for development, or configure real TBX credentials.",
      code: "NOT_CONFIGURED",
    });
    this.name = "TbxNotConfiguredError";
  }
}
