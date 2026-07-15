// ============================================================
// FinRP — TbxStatementHttpClient
//
// Real provider architecture + authentication framework for TBX's
// Statement API. Same discipline as lib/tbx/balance/balance.client.ts:
// config, token caching/refresh scheduling, and the generic
// authenticated-request wrapper are fully implemented; the OAuth
// token call and the statement fetch call itself throw
// TbxStatementEndpointNotBoundError instead of guessing a URL.
// ============================================================

import { getTbxBankingConfig, isTbxBankingMockMode } from "@/lib/tbx/balance/balance.client";
import {
  TbxStatementEndpointNotBoundError,
  TbxStatementNotConfiguredError,
  TbxStatementProviderError,
  type FetchStatementInput,
  type FetchStatementResult,
  type TbxStatementProvider,
} from "./statement.types";

const REQUEST_TIMEOUT_MS = 30_000; // statement pulls can cover a wider date range than a balance check
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

export class TbxStatementHttpClient implements TbxStatementProvider {
  readonly name = "TBX_STATEMENT_HTTP" as const;

  private cachedToken: CachedToken | null = null;

  // -------------------------------------------------------------------------
  // Authentication framework — shares the TBX Banking config/credentials
  // with the Balance client (same TBX Corporate Internet Banking product
  // surface); token caching is real, the acquisition call is undocumented.
  // -------------------------------------------------------------------------
  private async getAccessToken(): Promise<CachedToken> {
    if (this.cachedToken && this.cachedToken.expiresAt.getTime() - TOKEN_REFRESH_SKEW_MS > Date.now()) {
      return this.cachedToken;
    }
    throw new TbxStatementEndpointNotBoundError("OAuth token acquisition");
  }

  // -------------------------------------------------------------------------
  // Generic authenticated HTTP request wrapper — identical hardening to
  // balance.client.ts's request(), endpoint-agnostic.
  // -------------------------------------------------------------------------
  private async request<T = JsonRecord>(
    method: "GET" | "POST",
    path: string,
    body?: JsonRecord
  ): Promise<{ data: T; statusCode: number; durationMs: number; headers: Record<string, string>; retryCount: number }> {
    const config = getTbxBankingConfig();
    if (config.mockMode) throw new TbxStatementNotConfiguredError();

    const { accessToken } = await this.getAccessToken();
    const url = `${config.baseUrl}${path}`;

    let lastError: TbxStatementProviderError | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const startedAt = Date.now();

      try {
        const res = await fetch(url, {
          method,
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
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
          return { data: (text ? JSON.parse(text) : {}) as T, statusCode: res.status, durationMs, headers, retryCount: attempt - 1 };
        }

        const retryable = res.status === 429 || res.status >= 500;
        lastError = new TbxStatementProviderError({
          message: `TBX Statement API ${method} ${path} failed with ${res.status}`,
          status: res.status,
          code: `HTTP_${res.status}`,
          retryable,
        });
        if (!retryable || attempt > MAX_RETRIES) throw lastError;

        const retryAfterHeader = res.headers.get("retry-after");
        const retryAfterMs = retryAfterHeader ? Math.min(Number(retryAfterHeader) * 1000 || 0, 30_000) : 0;
        await sleep(retryAfterMs || BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 500));
      } catch (err) {
        if (err instanceof TbxStatementProviderError) throw err;

        const isAbort = err instanceof Error && err.name === "AbortError";
        lastError = new TbxStatementProviderError({
          message: isAbort
            ? `TBX Statement API ${method} ${path} timed out after ${REQUEST_TIMEOUT_MS}ms`
            : `TBX Statement API ${method} ${path} network error: ${err instanceof Error ? err.message : String(err)}`,
          code: isAbort ? "TIMEOUT" : "NETWORK_ERROR",
          retryable: true,
        });
        if (attempt > MAX_RETRIES) throw lastError;
        await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 500));
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new TbxStatementProviderError({ message: "TBX Statement API request failed" });
  }

  // -------------------------------------------------------------------------
  // Statement fetch — pending a real endpoint binding (see file header).
  // -------------------------------------------------------------------------
  async fetchStatement(_input: FetchStatementInput): Promise<FetchStatementResult> {
    void _input;
    // Once TBX publishes real docs, replace this with:
    //   const res = await this.request<JsonRecord>("GET", "<real statement path>", { ... });
    //   return statementMapper.fromTbxResponse(res.data);
    throw new TbxStatementEndpointNotBoundError("fetchStatement");
  }
}

export { isTbxBankingMockMode };
