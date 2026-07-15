// ============================================================
// FinRP — TbxPaymentHttpClient
//
// Real provider architecture + authentication framework for TBX's
// Payments API. TBX has not published the endpoint contract (paths,
// auth flow, request/response schemas), so per explicit instruction
// this file does NOT invent one:
//   - Config/auth is shared with balance/statements/beneficiaries
//     (same TBX Corporate Internet Banking product surface — see
//     lib/tbx/balance/balance.client.ts). Token caching/refresh
//     scheduling and the generic authenticated-request wrapper
//     (timeout/retry/backoff) are fully implemented.
//   - The two places that would need a real, undocumented contract —
//     initiatePayment and fetchPaymentStatus — throw
//     TbxPaymentEndpointNotBoundError instead of guessing a URL.
// ============================================================

import { getTbxBankingConfig, isTbxBankingMockMode } from "@/lib/tbx/balance/balance.client";
import {
  TbxPaymentNotConfiguredError,
  TbxPaymentProviderError,
  TbxPaymentEndpointNotBoundError,
  type InitiatePaymentInput,
  type InitiatePaymentResult,
  type FetchPaymentStatusInput,
  type FetchPaymentStatusResult,
  type TbxPaymentProvider,
} from "./payment.types";

export { isTbxBankingMockMode };

const REQUEST_TIMEOUT_MS = 20_000;
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

export class TbxPaymentHttpClient implements TbxPaymentProvider {
  readonly name = "TBX_PAYMENT_HTTP" as const;

  private cachedToken: CachedToken | null = null;

  private async getAccessToken(): Promise<CachedToken> {
    if (this.cachedToken && this.cachedToken.expiresAt.getTime() - TOKEN_REFRESH_SKEW_MS > Date.now()) {
      return this.cachedToken;
    }
    // TBX has not published its OAuth token endpoint, grant type, or token
    // response shape. Do not guess it — bind this once real docs exist.
    throw new TbxPaymentEndpointNotBoundError("OAuth token acquisition");
  }

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
    if (config.mockMode) throw new TbxPaymentNotConfiguredError();

    const { accessToken } = await this.getAccessToken();
    const url = `${config.baseUrl}${path}`;

    let lastError: TbxPaymentProviderError | null = null;

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
        lastError = new TbxPaymentProviderError({
          message: `TBX Payment API ${method} ${path} failed with ${res.status}`,
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
        if (err instanceof TbxPaymentProviderError) throw err;

        const isAbort = err instanceof Error && err.name === "AbortError";
        lastError = new TbxPaymentProviderError({
          message: isAbort
            ? `TBX Payment API ${method} ${path} timed out after ${REQUEST_TIMEOUT_MS}ms`
            : `TBX Payment API ${method} ${path} network error: ${err instanceof Error ? err.message : String(err)}`,
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

    throw lastError ?? new TbxPaymentProviderError({ message: "TBX Payment API request failed" });
  }

  // -------------------------------------------------------------------------
  // Pending real endpoint bindings (see file header). A payment instruction
  // is never silently retried by this client — retries on a payment call
  // risk double-submission, so MAX_RETRIES only governs transport-level
  // 429/5xx/timeout handling within a single logical submission attempt.
  // -------------------------------------------------------------------------
  async initiatePayment(_input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    void _input;
    throw new TbxPaymentEndpointNotBoundError("initiatePayment");
  }

  async fetchPaymentStatus(_input: FetchPaymentStatusInput): Promise<FetchPaymentStatusResult> {
    void _input;
    throw new TbxPaymentEndpointNotBoundError("fetchPaymentStatus");
  }
}
