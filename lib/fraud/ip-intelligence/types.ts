// ============================================================
// lib/fraud/ip-intelligence/types.ts
// IP reputation / geolocation (VPN/proxy/datacenter detection,
// country risk) requires a paid or rate-limited vendor (IPQualityScore,
// MaxMind, ipapi) for production-grade accuracy — same real-client +
// fail-loud-until-bound pattern as every other unconfirmed vendor
// integration in this codebase (TBX, Credit Bureau, AML negative
// media).
// ============================================================

export interface IpIntelligenceInput {
  ipAddress: string;
}

export interface IpIntelligenceResult {
  outcome: "SUCCESS" | "FAILED";
  riskScore?: number; // 0-100, higher = riskier
  country?: string;
  isVpn?: boolean;
  isProxy?: boolean;
  isDatacenter?: boolean;
  raw: unknown;
  failureReason?: string;
}

export interface IpIntelligenceProvider {
  readonly name: string;
  lookup(input: IpIntelligenceInput): Promise<IpIntelligenceResult>;
}

export class IpIntelligenceProviderError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly retryable: boolean;
  constructor(opts: { message: string; status?: number | null; code?: string; retryable?: boolean }) {
    super(opts.message);
    this.name = "IpIntelligenceProviderError";
    this.status = opts.status ?? null;
    this.code = opts.code ?? "PROVIDER_ERROR";
    this.retryable = opts.retryable ?? false;
  }
}

export class IpIntelligenceNotConfiguredError extends IpIntelligenceProviderError {
  constructor() {
    super({
      message: "No IP intelligence vendor configured — set IP_INTELLIGENCE_MOCK_MODE=true for development, or configure real vendor credentials (IP_INTELLIGENCE_BASE_URL / IP_INTELLIGENCE_API_KEY).",
      code: "NOT_CONFIGURED",
    });
    this.name = "IpIntelligenceNotConfiguredError";
  }
}

export class IpIntelligenceEndpointNotBoundError extends IpIntelligenceProviderError {
  constructor(operation: string) {
    super({
      message: `IP intelligence provider — "${operation}" has no bound endpoint yet. No vendor contract has been provided to this codebase. Set IP_INTELLIGENCE_MOCK_MODE=true for development, or bind this operation to a real vendor's documented endpoint.`,
      code: "ENDPOINT_NOT_BOUND",
      retryable: false,
    });
    this.name = "IpIntelligenceEndpointNotBoundError";
  }
}
