// ============================================================
// lib/aml/negative-media/types.ts
//
// Negative media screening (adverse news) requires a paid vendor
// (e.g. ComplyAdvantage, Refinitiv World-Check, Dow Jones Risk &
// Compliance) — there is no free public equivalent to OFAC/UN.
// Follows the exact same real-client + fail-loud-until-bound pattern
// as lib/tbx and lib/credit, since no vendor contract has been
// provided to this codebase.
// ============================================================

export interface NegativeMediaSearchInput {
  subjectName: string;
  entityType: "INDIVIDUAL" | "ORGANIZATION";
  country?: string;
}

export interface NegativeMediaHit {
  headline: string;
  source: string;
  publishedDate?: string;
  url?: string;
  category?: string; // e.g. "Fraud", "Sanctions", "Corruption"
  relevanceScore?: number;
}

export interface NegativeMediaSearchResult {
  outcome: "SUCCESS" | "FAILED";
  hits: NegativeMediaHit[];
  raw: unknown;
  failureReason?: string;
}

export interface NegativeMediaProvider {
  readonly name: string;
  search(input: NegativeMediaSearchInput): Promise<NegativeMediaSearchResult>;
}

export class NegativeMediaProviderError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly retryable: boolean;

  constructor(opts: { message: string; status?: number | null; code?: string; retryable?: boolean }) {
    super(opts.message);
    this.name = "NegativeMediaProviderError";
    this.status = opts.status ?? null;
    this.code = opts.code ?? "PROVIDER_ERROR";
    this.retryable = opts.retryable ?? false;
  }
}

export class NegativeMediaNotConfiguredError extends NegativeMediaProviderError {
  constructor() {
    super({
      message:
        "No negative-media vendor is configured — set NEGATIVE_MEDIA_MOCK_MODE=true for development, or " +
        "configure real vendor credentials (NEGATIVE_MEDIA_BASE_URL / NEGATIVE_MEDIA_API_KEY).",
      code: "NOT_CONFIGURED",
    });
    this.name = "NegativeMediaNotConfiguredError";
  }
}

export class NegativeMediaEndpointNotBoundError extends NegativeMediaProviderError {
  constructor(operation: string) {
    super({
      message:
        `Negative media provider — "${operation}" has no bound endpoint yet. No vendor contract (ComplyAdvantage/` +
        `World-Check/Dow Jones) has been provided to this codebase. Set NEGATIVE_MEDIA_MOCK_MODE=true for ` +
        `development, or bind this operation to a real vendor's documented endpoint.`,
      code: "ENDPOINT_NOT_BOUND",
      retryable: false,
    });
    this.name = "NegativeMediaEndpointNotBoundError";
  }
}
