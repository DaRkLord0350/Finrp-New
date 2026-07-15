// ============================================================
// FinRP — TbxBeneficiaryHttpClient
//
// Real provider architecture + authentication framework for TBX's
// Beneficiary Management API. TBX has not published the endpoint
// contract (paths, auth flow, request/response schemas), so per
// explicit instruction this file does NOT invent one:
//   - Config/auth is shared with balance/statements (same TBX
//     Corporate Internet Banking product surface — see
//     lib/tbx/balance/balance.client.ts). Token caching/refresh
//     scheduling and the generic authenticated-request wrapper
//     (timeout/retry/backoff) are fully implemented — none of that
//     is endpoint-specific.
//   - The three places that would need a real, undocumented
//     contract — create/verify/fetch-status — throw
//     TbxBeneficiaryEndpointNotBoundError instead of guessing a URL.
// Once TBX publishes real docs, only these three methods' request()
// calls need to change.
// ============================================================

import { getTbxBankingConfig, isTbxBankingMockMode } from "@/lib/tbx/balance/balance.client";
import {
  TbxBeneficiaryNotConfiguredError,
  TbxBeneficiaryProviderError,
  TbxBeneficiaryEndpointNotBoundError,
  type CreateBeneficiaryInput,
  type CreateBeneficiaryResult,
  type VerifyBeneficiaryInput,
  type VerifyBeneficiaryResult,
  type FetchBeneficiaryStatusInput,
  type FetchBeneficiaryStatusResult,
  type TbxBeneficiaryProvider,
} from "./beneficiary.types";

export { isTbxBankingMockMode };

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1_000;
const TOKEN_REFRESH_SKEW_MS = 60_000;

type JsonRecord = Record<string, unknown>;

interface CachedToken {
  accessToken: string;
  expiresAt: Date;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class TbxBeneficiaryHttpClient implements TbxBeneficiaryProvider {
  readonly name = "TBX_BENEFICIARY_HTTP" as const;

  private cachedToken: CachedToken | null = null;

  // -------------------------------------------------------------------------
  // Authentication framework — token caching/refresh scheduling is real;
  // the actual token-acquisition call is the undocumented piece.
  // -------------------------------------------------------------------------
  private async getAccessToken(): Promise<CachedToken> {
    if (this.cachedToken && this.cachedToken.expiresAt.getTime() - TOKEN_REFRESH_SKEW_MS > Date.now()) {
      return this.cachedToken;
    }

    // TBX has not published its OAuth token endpoint, grant type, or token
    // response shape. Do not guess it — bind this once real docs exist.
    throw new TbxBeneficiaryEndpointNotBoundError("OAuth token acquisition");
  }

  // -------------------------------------------------------------------------
  // Generic authenticated HTTP request wrapper — timeout/retry/backoff is
  // real and endpoint-agnostic; reused unchanged once real endpoint paths
  // are bound.
  // -------------------------------------------------------------------------
  private async request<T = JsonRecord>(
    method: "GET" | "POST",
    path: string,
    body?: JsonRecord
  ): Promise<{
    data: T;
    statusCode: number;
    durationMs: number;
    headers: Record<string, string>;
    retryCount: number;
  }> {
    const config = getTbxBankingConfig();
    if (config.mockMode) throw new TbxBeneficiaryNotConfiguredError();

    const { accessToken } = await this.getAccessToken();
    const url = `${config.baseUrl}${path}`;

    let lastError: TbxBeneficiaryProviderError | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const startedAt = Date.now();

      try {
        const res = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        const durationMs = Date.now() - startedAt;
        const text = await res.text();
        const headers: Record<string, string> = {};
        res.headers.forEach((value, key) => {
          headers[key] = value;
        });

        if (res.ok) {
          return {
            data: (text ? JSON.parse(text) : {}) as T,
            statusCode: res.status,
            durationMs,
            headers,
            retryCount: attempt - 1,
          };
        }

        const retryable = res.status === 429 || res.status >= 500;
        lastError = new TbxBeneficiaryProviderError({
          message: `TBX Beneficiary API ${method} ${path} failed with ${res.status}`,
          status: res.status,
          code: `HTTP_${res.status}`,
          retryable,
        });

        if (!retryable || attempt > MAX_RETRIES) throw lastError;

        const retryAfterHeader = res.headers.get("retry-after");
        const retryAfterMs = retryAfterHeader ? Math.min(Number(retryAfterHeader) * 1000 || 0, 30_000) : 0;
        const backoffMs = retryAfterMs || BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 500);
        await sleep(backoffMs);
      } catch (err) {
        if (err instanceof TbxBeneficiaryProviderError) throw err;

        const isAbort = err instanceof Error && err.name === "AbortError";
        lastError = new TbxBeneficiaryProviderError({
          message: isAbort
            ? `TBX Beneficiary API ${method} ${path} timed out after ${REQUEST_TIMEOUT_MS}ms`
            : `TBX Beneficiary API ${method} ${path} network error: ${err instanceof Error ? err.message : String(err)}`,
          code: isAbort ? "TIMEOUT" : "NETWORK_ERROR",
          retryable: true,
        });

        if (attempt > MAX_RETRIES) throw lastError;
        const backoffMs = BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 500);
        await sleep(backoffMs);
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new TbxBeneficiaryProviderError({ message: "TBX Beneficiary API request failed" });
  }

  // -------------------------------------------------------------------------
  // Pending real endpoint bindings (see file header).
  // -------------------------------------------------------------------------
  async createBeneficiary(_input: CreateBeneficiaryInput): Promise<CreateBeneficiaryResult> {
    void _input;
    throw new TbxBeneficiaryEndpointNotBoundError("createBeneficiary");
  }

  async verifyBeneficiary(_input: VerifyBeneficiaryInput): Promise<VerifyBeneficiaryResult> {
    void _input;
    throw new TbxBeneficiaryEndpointNotBoundError("verifyBeneficiary");
  }

  async fetchBeneficiaryStatus(_input: FetchBeneficiaryStatusInput): Promise<FetchBeneficiaryStatusResult> {
    void _input;
    throw new TbxBeneficiaryEndpointNotBoundError("fetchBeneficiaryStatus");
  }
}
