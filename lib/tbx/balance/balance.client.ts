// ============================================================
// FinRP — TbxBalanceHttpClient
//
// Real provider architecture + authentication framework for TBX's
// Balance API. TBX has not published the endpoint contract (paths,
// auth flow, request/response schemas), so per explicit instruction
// this file does NOT invent one:
//   - Config, token caching/refresh scheduling, and the generic
//     authenticated-request wrapper (timeout/retry/backoff/logging)
//     are fully implemented — none of that is endpoint-specific.
//   - The two places that would need a real, undocumented contract —
//     OAuth token acquisition and the balance fetch call itself —
//     throw TbxEndpointNotBoundError instead of guessing a URL.
// Once TBX publishes real docs, only getAccessToken()'s token-fetch
// body and fetchBalances()'s request() call need to change.
// ============================================================

import {
  TbxBalanceNotConfiguredError,
  TbxBalanceProviderError,
  TbxEndpointNotBoundError,
  type FetchBalancesInput,
  type FetchBalancesResult,
  type TbxBalanceProvider,
} from "./balance.types";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1_000;
/** Refresh the cached token this long before it actually expires. */
const TOKEN_REFRESH_SKEW_MS = 60_000;

type JsonRecord = Record<string, unknown>;

export interface TbxBankingConfig {
  mockMode: boolean;
  env: "sandbox" | "production";
  baseUrl: string;
  clientId: string;
  clientSecret: string;
}

export class TbxBankingConfigError extends Error {
  constructor(missing: string[]) {
    super(
      `TBX Banking is not configured — missing environment variable(s): ${missing.join(", ")}. ` +
        `Set TBX_BANKING_MOCK_MODE=true for development, or configure real TBX credentials.`
    );
    this.name = "TbxBankingConfigError";
  }
}

export function isTbxBankingMockMode(): boolean {
  return (process.env.TBX_BANKING_MOCK_MODE ?? "").toLowerCase() === "true";
}

/** Reads TBX Banking configuration from the environment (same fail-fast shape as lib/tbx/config.ts). */
export function getTbxBankingConfig(): TbxBankingConfig {
  const mockMode = isTbxBankingMockMode();
  const env = (process.env.TBX_BANKING_ENV ?? "sandbox").toLowerCase() === "production" ? "production" : "sandbox";
  const clientId = process.env.TBX_BANKING_CLIENT_ID ?? "";
  const clientSecret = process.env.TBX_BANKING_CLIENT_SECRET ?? "";
  const baseUrl = process.env.TBX_BANKING_BASE_URL ?? "";

  if (!mockMode) {
    const missing: string[] = [];
    if (!clientId) missing.push("TBX_BANKING_CLIENT_ID");
    if (!clientSecret) missing.push("TBX_BANKING_CLIENT_SECRET");
    if (!baseUrl) missing.push("TBX_BANKING_BASE_URL");
    if (missing.length > 0) throw new TbxBankingConfigError(missing);
  }

  return { mockMode, env, baseUrl, clientId, clientSecret };
}

interface CachedToken {
  accessToken: string;
  expiresAt: Date;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class TbxBalanceHttpClient implements TbxBalanceProvider {
  readonly name = "TBX_BALANCE_HTTP" as const;

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
    // response shape. Do not guess it — bind this once real docs exist:
    //   const token = await this.request<{access_token, expires_in}>("POST", "<real token path>", {...});
    //   this.cachedToken = { accessToken: token.data.access_token, expiresAt: new Date(Date.now() + token.data.expires_in * 1000) };
    //   return this.cachedToken;
    throw new TbxEndpointNotBoundError("OAuth token acquisition");
  }

  // -------------------------------------------------------------------------
  // Generic authenticated HTTP request wrapper — timeout/retry/backoff/
  // logging is real and endpoint-agnostic; reused unchanged once real
  // endpoint paths are bound.
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
    if (config.mockMode) throw new TbxBalanceNotConfiguredError();

    const { accessToken } = await this.getAccessToken();
    const url = `${config.baseUrl}${path}`;

    let lastError: TbxBalanceProviderError | null = null;

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
        lastError = new TbxBalanceProviderError({
          message: `TBX Balance API ${method} ${path} failed with ${res.status}`,
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
        if (err instanceof TbxBalanceProviderError) throw err;

        const isAbort = err instanceof Error && err.name === "AbortError";
        lastError = new TbxBalanceProviderError({
          message: isAbort
            ? `TBX Balance API ${method} ${path} timed out after ${REQUEST_TIMEOUT_MS}ms`
            : `TBX Balance API ${method} ${path} network error: ${err instanceof Error ? err.message : String(err)}`,
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

    throw lastError ?? new TbxBalanceProviderError({ message: "TBX Balance API request failed" });
  }

  // -------------------------------------------------------------------------
  // Balance fetch — pending a real endpoint binding (see file header).
  // -------------------------------------------------------------------------
  async fetchBalances(_input: FetchBalancesInput): Promise<FetchBalancesResult> {
    void _input;
    // Once TBX publishes real docs, replace this with:
    //   const res = await this.request<JsonRecord>("GET", "<real balance path>", { ... });
    //   return balanceMapper.fromTbxResponse(res.data);
    throw new TbxEndpointNotBoundError("fetchBalances");
  }
}
