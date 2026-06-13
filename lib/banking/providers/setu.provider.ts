// ============================================================
// FinRP Banking OS — SetuProvider
// Production Setu Account Aggregator (FIU v2 API) client.
// Docs: https://docs.setu.co/data/account-aggregator
//
//   Consent:  POST /v2/consents → hosted approval URL
//             GET  /v2/consents/{id} → status + linked accounts
//             POST /v2/consents/{id}/revoke
//   FI data:  POST /v2/sessions → data session
//             GET  /v2/sessions/{id} → decrypted FI payload
//
// Hardening: timeouts (AbortController), bounded retries with
// exponential backoff + jitter on 429/5xx/network errors,
// Retry-After support, structured logging, x-request-id
// propagation for idempotent tracing. No mock paths.
// ============================================================

import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { getSetuConfig } from "../setu/config";
import { createBankingLogger } from "../logger";
import {
  BankingProviderError,
  type BankingProvider,
  type ConsentResult,
  type ConsentStatusResult,
  type CreateConsentInput,
  type DataSessionInput,
  type DiscoveredAccount,
  type FIDataResult,
  type NormalizedBalance,
  type NormalizedTransaction,
  type WebhookVerification,
} from "./types";

const log = createBankingLogger("setu.provider");

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1_000;

// Session polling: Setu FIP data prep usually completes in seconds;
// webhooks are the primary signal — polling is the fallback.
const SESSION_POLL_ATTEMPTS = 10;
const SESSION_POLL_DELAY_MS = 3_000;

type JsonRecord = Record<string, unknown>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SetuProvider implements BankingProvider {
  readonly name = "SETU" as const;

  // -------------------------------------------------------------------------
  // HTTP core
  // -------------------------------------------------------------------------
  private async request<T = JsonRecord>(
    method: "GET" | "POST",
    path: string,
    body?: JsonRecord
  ): Promise<T> {
    const config = getSetuConfig();
    const url = `${config.baseUrl}${path}`;
    const requestId = randomUUID();

    let lastError: BankingProviderError | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const startedAt = Date.now();

      try {
        const res = await fetch(url, {
          method,
          headers: {
            "x-client-id": config.clientId,
            "x-client-secret": config.clientSecret,
            "x-product-instance-id": config.productInstanceId,
            "x-request-id": requestId,
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        const durationMs = Date.now() - startedAt;
        const text = await res.text();

        if (res.ok) {
          log.info("setu request ok", { method, path, status: res.status, durationMs, attempt, requestId });
          return (text ? JSON.parse(text) : {}) as T;
        }

        const retryable = res.status === 429 || res.status >= 500;
        let errorCode = `HTTP_${res.status}`;
        let errorMessage = `Setu ${method} ${path} failed with ${res.status}`;
        try {
          const parsed = JSON.parse(text) as JsonRecord;
          const err = (parsed.error ?? parsed) as JsonRecord;
          if (typeof err.code === "string") errorCode = err.code;
          if (typeof err.detail === "string") errorMessage = err.detail;
          else if (typeof err.message === "string") errorMessage = err.message;
        } catch {
          // non-JSON error body — keep defaults
        }

        lastError = new BankingProviderError({
          provider: "SETU",
          message: errorMessage,
          status: res.status,
          code: errorCode,
          retryable,
          requestId,
        });

        if (!retryable || attempt > MAX_RETRIES) {
          log.error("setu request failed", { method, path, status: res.status, code: errorCode, durationMs, attempt, requestId });
          throw lastError;
        }

        // Respect Retry-After on 429; otherwise exponential backoff + jitter.
        const retryAfterHeader = res.headers.get("retry-after");
        const retryAfterMs = retryAfterHeader
          ? Math.min(Number(retryAfterHeader) * 1000 || 0, 30_000)
          : 0;
        const backoffMs =
          retryAfterMs || BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 500);

        log.warn("setu request retrying", { method, path, status: res.status, attempt, backoffMs, requestId });
        await sleep(backoffMs);
      } catch (err) {
        if (err instanceof BankingProviderError) throw err;

        // Network failure / timeout — retryable.
        const isAbort = err instanceof Error && err.name === "AbortError";
        lastError = new BankingProviderError({
          provider: "SETU",
          message: isAbort
            ? `Setu ${method} ${path} timed out after ${REQUEST_TIMEOUT_MS}ms`
            : `Setu ${method} ${path} network error: ${err instanceof Error ? err.message : String(err)}`,
          code: isAbort ? "TIMEOUT" : "NETWORK_ERROR",
          retryable: true,
          requestId,
        });

        if (attempt > MAX_RETRIES) {
          log.error("setu request exhausted retries", { method, path, code: lastError.code, attempt, requestId });
          throw lastError;
        }

        const backoffMs = BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 500);
        log.warn("setu request retrying after network error", { method, path, attempt, backoffMs, requestId });
        await sleep(backoffMs);
      } finally {
        clearTimeout(timer);
      }
    }

    // Unreachable, but keeps TypeScript exhaustive.
    throw lastError ?? new BankingProviderError({ provider: "SETU", message: "Setu request failed" });
  }

  // -------------------------------------------------------------------------
  // Consent lifecycle
  // -------------------------------------------------------------------------
  async createConsent(input: CreateConsentInput): Promise<ConsentResult> {
    const now = new Date();
    const from = input.dataRange?.from ?? new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const to = input.dataRange?.to ?? now;

    const body: JsonRecord = {
      consentDuration: { unit: "MONTH", value: "12" },
      dataRange: { from: from.toISOString(), to: to.toISOString() },
      redirectUrl: input.redirectUrl,
      context: input.context ?? [],
    };
    if (input.vua) {
      // Bare mobile numbers get the default sandbox/production AA handle.
      body.vua = input.vua.includes("@") ? input.vua : `${input.vua}@onemoney`;
    }

    const data = await this.request<JsonRecord>("POST", "/v2/consents", body);

    const consentId = String(data.id ?? "");
    const redirectUrl = String(data.url ?? "");
    if (!consentId || !redirectUrl) {
      throw new BankingProviderError({
        provider: "SETU",
        message: "Setu createConsent returned no id/url — check product instance configuration",
        code: "MALFORMED_RESPONSE",
      });
    }

    log.info("consent created", { consentId, organizationId: input.organizationId });
    return { consentId, redirectUrl, status: String(data.status ?? "PENDING"), raw: data };
  }

  connectBank(input: CreateConsentInput): Promise<ConsentResult> {
    return this.createConsent(input);
  }

  async getConsentStatus(consentId: string): Promise<ConsentStatusResult> {
    const data = await this.request<JsonRecord>("GET", `/v2/consents/${encodeURIComponent(consentId)}`);

    const rawStatus = String(data.status ?? "PENDING").toUpperCase();
    const status = (["PENDING", "ACTIVE", "REJECTED", "REVOKED", "PAUSED", "EXPIRED"] as const).includes(
      rawStatus as never
    )
      ? (rawStatus as ConsentStatusResult["status"])
      : "PENDING";

    return {
      consentId,
      status,
      linkedAccounts: parseLinkedAccounts(data),
      raw: data,
    };
  }

  async revokeConsent(consentId: string): Promise<void> {
    try {
      await this.request("POST", `/v2/consents/${encodeURIComponent(consentId)}/revoke`);
      log.info("consent revoked", { consentId });
    } catch (err) {
      // Already revoked/expired at the provider is success for our purposes.
      if (err instanceof BankingProviderError && (err.status === 404 || err.status === 409)) {
        log.warn("consent revoke no-op (already inactive at provider)", { consentId, status: err.status });
        return;
      }
      throw err;
    }
  }

  disconnectBank(consentId: string): Promise<void> {
    return this.revokeConsent(consentId);
  }

  // -------------------------------------------------------------------------
  // FI data sessions
  // -------------------------------------------------------------------------
  async createDataSession(input: DataSessionInput): Promise<{ sessionId: string; status: string }> {
    const data = await this.request<JsonRecord>("POST", "/v2/sessions", {
      consentId: input.consentId,
      dataRange: {
        from: input.dataRange.from.toISOString(),
        to: input.dataRange.to.toISOString(),
      },
      format: "json",
    });

    const sessionId = String(data.id ?? "");
    if (!sessionId) {
      throw new BankingProviderError({
        provider: "SETU",
        message: "Setu createDataSession returned no session id",
        code: "MALFORMED_RESPONSE",
      });
    }

    log.info("data session created", { sessionId, consentId: input.consentId });
    return { sessionId, status: String(data.status ?? "PENDING") };
  }

  async fetchSessionData(sessionId: string): Promise<FIDataResult> {
    const data = await this.request<JsonRecord>("GET", `/v2/sessions/${encodeURIComponent(sessionId)}`);
    const status = String(data.status ?? "PENDING").toUpperCase() as FIDataResult["status"];

    const result: FIDataResult = {
      sessionId,
      status: (["PENDING", "COMPLETED", "PARTIAL", "FAILED", "EXPIRED"] as const).includes(status as never)
        ? status
        : "PENDING",
      accounts: [],
      balances: [],
      transactions: [],
      raw: data,
    };

    if (result.status === "COMPLETED" || result.status === "PARTIAL") {
      const parsed = parseFIPayload(data);
      result.accounts = parsed.accounts;
      result.balances = parsed.balances;
      result.transactions = parsed.transactions;
    }

    return result;
  }

  /** Session → poll until terminal state → parsed payload. */
  async refreshData(input: DataSessionInput): Promise<FIDataResult> {
    const { sessionId } = await this.createDataSession(input);

    for (let attempt = 1; attempt <= SESSION_POLL_ATTEMPTS; attempt++) {
      const result = await this.fetchSessionData(sessionId);

      if (result.status === "COMPLETED" || result.status === "PARTIAL") {
        log.info("session data ready", {
          sessionId,
          status: result.status,
          accounts: result.accounts.length,
          transactions: result.transactions.length,
          attempt,
        });
        return result;
      }
      if (result.status === "FAILED" || result.status === "EXPIRED") {
        throw new BankingProviderError({
          provider: "SETU",
          message: `Setu data session ${sessionId} ended in ${result.status}`,
          code: `SESSION_${result.status}`,
        });
      }

      await sleep(SESSION_POLL_DELAY_MS);
    }

    throw new BankingProviderError({
      provider: "SETU",
      message: `Setu data session ${sessionId} not ready after ${SESSION_POLL_ATTEMPTS} polls — webhook will complete it`,
      code: "SESSION_PENDING_TIMEOUT",
      retryable: true,
    });
  }

  async syncAccount(input: DataSessionInput & { linkRefNumber?: string }): Promise<FIDataResult> {
    const result = await this.refreshData(input);
    if (!input.linkRefNumber) return result;

    return {
      ...result,
      accounts: result.accounts.filter((a) => a.linkRefNumber === input.linkRefNumber),
      balances: result.balances.filter((b) => b.linkRefNumber === input.linkRefNumber),
      transactions: result.transactions.filter((t) => t.linkRefNumber === input.linkRefNumber),
    };
  }

  async fetchAccounts(input: DataSessionInput): Promise<DiscoveredAccount[]> {
    return (await this.refreshData(input)).accounts;
  }

  async fetchBalances(input: DataSessionInput): Promise<NormalizedBalance[]> {
    return (await this.refreshData(input)).balances;
  }

  async fetchTransactions(input: DataSessionInput): Promise<NormalizedTransaction[]> {
    return (await this.refreshData(input)).transactions;
  }

  // -------------------------------------------------------------------------
  // Webhook verification — HMAC-SHA256 over the raw body.
  // Setu signs with the webhook secret configured in The Bridge; we accept
  // hex or base64 digests. Sandbox without a secret → accepted but flagged.
  // -------------------------------------------------------------------------
  verifyWebhook(rawBody: string, signature: string | null): WebhookVerification {
    const config = getSetuConfig();

    if (!config.webhookSecret) {
      if (config.env === "production") {
        return { valid: false, reason: "SETU_WEBHOOK_SECRET not configured in production" };
      }
      log.warn("webhook accepted without signature verification (sandbox, no secret)");
      return { valid: true, reason: "sandbox-unsigned" };
    }

    if (!signature) {
      // Sandbox webhooks are frequently unsigned; never trust unsigned in prod.
      if (config.env === "production") {
        return { valid: false, reason: "missing signature header" };
      }
      log.warn("webhook missing signature header (sandbox) — accepting, flagged unverified");
      return { valid: true, reason: "sandbox-unsigned" };
    }

    const hmac = createHmac("sha256", config.webhookSecret).update(rawBody);
    const digestHex = hmac.digest();
    const candidates = [digestHex.toString("hex"), digestHex.toString("base64")];

    const provided = Buffer.from(signature.trim());
    for (const candidate of candidates) {
      const expected = Buffer.from(candidate);
      if (provided.length === expected.length && timingSafeEqual(provided, expected)) {
        return { valid: true };
      }
    }
    return { valid: false, reason: "signature mismatch" };
  }
}

// ---------------------------------------------------------------------------
// FI payload parsing — defensive against shape drift between Setu versions.
// v2 session payload:
//   { payload: [ { fipID, data: [ { linkRefNumber, maskedAccNumber,
//       decryptedFI: { account: { type, summary: {...},
//         transactions: { transaction: [...] } } } } ] } ] }
// ---------------------------------------------------------------------------

function asArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? (value as JsonRecord[]) : [];
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function parseFIPayload(sessionData: JsonRecord): {
  accounts: DiscoveredAccount[];
  balances: NormalizedBalance[];
  transactions: NormalizedTransaction[];
} {
  const accounts: DiscoveredAccount[] = [];
  const balances: NormalizedBalance[] = [];
  const transactions: NormalizedTransaction[] = [];

  for (const fipBlock of asArray(sessionData.payload ?? sessionData.fips ?? sessionData.FI)) {
    const fipId = typeof fipBlock.fipID === "string" ? fipBlock.fipID : undefined;

    for (const accountBlock of asArray(fipBlock.data ?? fipBlock.accounts)) {
      const decrypted = asRecord(accountBlock.decryptedFI ?? accountBlock.data ?? accountBlock);
      const account = asRecord(decrypted.account ?? decrypted.Account ?? decrypted);
      const summary = asRecord(account.summary ?? account.Summary);

      const linkRefNumber = String(
        accountBlock.linkRefNumber ?? account.linkedAccRef ?? account.linkRefNumber ?? ""
      );
      const maskedAccNumber = String(
        accountBlock.maskedAccNumber ?? account.maskedAccNumber ?? ""
      );
      if (!linkRefNumber && !maskedAccNumber) continue;

      accounts.push({
        linkRefNumber: linkRefNumber || maskedAccNumber,
        maskedAccNumber: maskedAccNumber || linkRefNumber,
        fiType: String(accountBlock.fiType ?? account.type ?? "DEPOSIT").toUpperCase(),
        accountType: typeof summary.type === "string" ? summary.type : undefined,
        fipId,
        fipName: typeof fipBlock.fipName === "string" ? fipBlock.fipName : undefined,
      });

      const currentBalance = toNumber(summary.currentBalance);
      if (currentBalance !== undefined) {
        balances.push({
          linkRefNumber: linkRefNumber || maskedAccNumber,
          maskedAccNumber: maskedAccNumber || linkRefNumber,
          currentBalance,
          availableBalance: toNumber(summary.availableBalance ?? summary.currentODLimit),
          currency: typeof summary.currency === "string" && summary.currency ? summary.currency : "INR",
          balanceDate: toDate(summary.balanceDateTime) ?? new Date(),
        });
      }

      const txnContainer = asRecord(account.transactions ?? account.Transactions);
      for (const txn of asArray(txnContainer.transaction ?? txnContainer.Transaction ?? account.transactions)) {
        const amount = toNumber(txn.amount);
        const txnDate = toDate(txn.transactionTimestamp ?? txn.transactionDateTime ?? txn.valueDate);
        const rawType = String(txn.type ?? "").toUpperCase();
        if (amount === undefined || !txnDate || (rawType !== "CREDIT" && rawType !== "DEBIT")) continue;

        const externalId = String(txn.txnId ?? txn.txnID ?? txn.id ?? "");
        transactions.push({
          // Synthesize a stable id when the FIP omits txnId so dedup still works.
          externalId:
            externalId ||
            `${linkRefNumber}:${txnDate.toISOString()}:${rawType}:${amount}:${String(txn.narration ?? "").slice(0, 40)}`,
          linkRefNumber: linkRefNumber || maskedAccNumber,
          maskedAccNumber: maskedAccNumber || linkRefNumber,
          type: rawType,
          mode: String(txn.mode ?? "OTHERS").toUpperCase(),
          amount,
          balanceAfter: toNumber(txn.currentBalance ?? txn.balance),
          transactionDate: txnDate,
          valueDate: toDate(txn.valueDate),
          narration: String(txn.narration ?? ""),
          reference: typeof txn.reference === "string" ? txn.reference : undefined,
        });
      }
    }
  }

  return { accounts, balances, transactions };
}

/** Linked accounts surfaced on GET /v2/consents/{id} (detail.accounts / accountsLinked). */
function parseLinkedAccounts(consentData: JsonRecord): DiscoveredAccount[] {
  const detail = asRecord(consentData.detail ?? consentData.Detail);
  const candidates = [
    consentData.accountsLinked,
    detail.accounts,
    consentData.accounts,
    asRecord(consentData.context).accounts,
  ];

  for (const candidate of candidates) {
    const list = asArray(candidate);
    if (list.length === 0) continue;
    return list
      .map((acc) => ({
        linkRefNumber: String(acc.linkRefNumber ?? acc.linkedAccRef ?? ""),
        maskedAccNumber: String(acc.maskedAccNumber ?? ""),
        fiType: String(acc.fiType ?? acc.FIType ?? "DEPOSIT").toUpperCase(),
        accountType: typeof acc.accType === "string" ? acc.accType : undefined,
        fipId: typeof acc.fipId === "string" ? acc.fipId : (typeof acc.fipID === "string" ? acc.fipID : undefined),
      }))
      .filter((acc) => acc.linkRefNumber || acc.maskedAccNumber);
  }
  return [];
}
