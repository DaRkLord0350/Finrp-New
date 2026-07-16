// ============================================================
// lib/fraud/biometric/types.ts
// Face match + liveness detection require a biometric KYC vendor
// (HyperVerge, Signzy, IDfy, FaceTec) — genuinely not buildable
// without one (unlike device fingerprinting). Real-client +
// fail-loud-until-bound pattern, same as every other unconfirmed
// vendor integration here.
// ============================================================

export interface FaceMatchInput {
  selfieImageUrl: string;
  idDocumentImageUrl: string;
}

export interface FaceMatchResult {
  outcome: "SUCCESS" | "FAILED";
  matchScore?: number; // 0-100
  raw: unknown;
  failureReason?: string;
}

export interface LivenessCheckInput {
  selfieImageUrl: string;
  /** Video/frame sequence reference, if the vendor requires active liveness. */
  sessionReference?: string;
}

export interface LivenessCheckResult {
  outcome: "SUCCESS" | "FAILED";
  passed?: boolean;
  confidenceScore?: number;
  raw: unknown;
  failureReason?: string;
}

export interface BiometricProvider {
  readonly name: string;
  matchFace(input: FaceMatchInput): Promise<FaceMatchResult>;
  checkLiveness(input: LivenessCheckInput): Promise<LivenessCheckResult>;
}

export class BiometricProviderError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly retryable: boolean;
  constructor(opts: { message: string; status?: number | null; code?: string; retryable?: boolean }) {
    super(opts.message);
    this.name = "BiometricProviderError";
    this.status = opts.status ?? null;
    this.code = opts.code ?? "PROVIDER_ERROR";
    this.retryable = opts.retryable ?? false;
  }
}

export class BiometricNotConfiguredError extends BiometricProviderError {
  constructor() {
    super({
      message: "No biometric KYC vendor configured — set BIOMETRIC_MOCK_MODE=true for development, or configure real vendor credentials (BIOMETRIC_BASE_URL / BIOMETRIC_API_KEY).",
      code: "NOT_CONFIGURED",
    });
    this.name = "BiometricNotConfiguredError";
  }
}

export class BiometricEndpointNotBoundError extends BiometricProviderError {
  constructor(operation: string) {
    super({
      message: `Biometric provider — "${operation}" has no bound endpoint yet. No vendor contract (HyperVerge/Signzy/IDfy/FaceTec) has been provided to this codebase. Set BIOMETRIC_MOCK_MODE=true for development, or bind this operation to a real vendor's documented endpoint.`,
      code: "ENDPOINT_NOT_BOUND",
      retryable: false,
    });
    this.name = "BiometricEndpointNotBoundError";
  }
}
