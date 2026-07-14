// ============================================================
// FinRP — TbxHttpProvider
//
// Real HTTP client for TBX (TransBnk) validation APIs. TBX has not
// published endpoint paths, auth mechanism, or request/response
// schemas to this codebase (see docs/TBX_FOUNDATION.md §14) — the
// endpoint paths and payload shapes below are PLACEHOLDERS derived
// from the product catalog's API names (TBX Validation APIs.xlsx)
// and must be corrected once real API documentation is available.
// The hardening around them (timeouts, retries, logging) does not
// need to change when that happens — only `request()`'s paths and
// each method's request/response mapping do.
//
// Hardening mirrors lib/banking/providers/setu.provider.ts:
// AbortController timeouts, bounded retries with exponential
// backoff + jitter on 429/5xx/network errors, Retry-After support,
// structured logging, x-request-id propagation.
// ============================================================

import { randomUUID } from "crypto";
import { getTbxConfig } from "./config";
import { createTbxLogger } from "./logger";
import {
  TbxProviderError,
  type CreateTbxCustomerInput,
  type CreateTbxCustomerResult,
  type FetchCkycInput,
  type FetchCkycResult,
  type FetchDirectorInput,
  type FetchDirectorResult,
  type ScreenAmlPepInput,
  type ScreenAmlPepResult,
  type TbxProvider,
  type VerifyAadhaarInput,
  type VerifyAadhaarResult,
  type VerifyBankAccountInput,
  type VerifyBankAccountResult,
  type VerifyCinInput,
  type VerifyCinResult,
  type VerifyGstinInput,
  type VerifyGstinResult,
  type VerifyPanInput,
  type VerifyPanResult,
} from "./types";

const log = createTbxLogger("provider");

const REQUEST_TIMEOUT_MS = 10_000; // wizard steps are synchronous — keep tight, async verification goes via Inngest
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1_000;

type JsonRecord = Record<string, unknown>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class TbxHttpProvider implements TbxProvider {
  readonly name = "TBX_HTTP" as const;

  // -------------------------------------------------------------------------
  // HTTP core — mirrors SetuProvider.request() exactly
  // -------------------------------------------------------------------------
  private async request<T = JsonRecord>(
    method: "GET" | "POST",
    path: string,
    body?: JsonRecord
  ): Promise<{
    data: T;
    requestId: string;
    statusCode: number;
    durationMs: number;
    headers: Record<string, string>;
    retryCount: number;
  }> {
    const config = getTbxConfig();
    const url = `${config.baseUrl}${path}`;
    const requestId = randomUUID();

    let lastError: TbxProviderError | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const startedAt = Date.now();

      try {
        const res = await fetch(url, {
          method,
          headers: {
            // Auth header shape is unconfirmed — TODO once TBX publishes docs.
            "x-api-key": config.apiKey || config.clientId,
            "x-client-secret": config.clientSecret,
            "x-request-id": requestId,
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
          log.info("tbx request ok", { method, path, status: res.status, durationMs, attempt, requestId });
          return {
            data: (text ? JSON.parse(text) : {}) as T,
            requestId,
            statusCode: res.status,
            durationMs,
            headers,
            retryCount: attempt - 1,
          };
        }

        const retryable = res.status === 429 || res.status >= 500;
        let errorCode = `HTTP_${res.status}`;
        let errorMessage = `TBX ${method} ${path} failed with ${res.status}`;
        try {
          const parsed = JSON.parse(text) as JsonRecord;
          const err = (parsed.error ?? parsed) as JsonRecord;
          if (typeof err.code === "string") errorCode = err.code;
          if (typeof err.message === "string") errorMessage = err.message;
        } catch {
          // non-JSON error body — keep defaults
        }

        lastError = new TbxProviderError({
          message: errorMessage,
          status: res.status,
          code: errorCode,
          retryable,
          requestId,
        });

        if (!retryable || attempt > MAX_RETRIES) {
          log.error("tbx request failed", { method, path, status: res.status, code: errorCode, durationMs, attempt, requestId });
          throw lastError;
        }

        const retryAfterHeader = res.headers.get("retry-after");
        const retryAfterMs = retryAfterHeader ? Math.min(Number(retryAfterHeader) * 1000 || 0, 30_000) : 0;
        const backoffMs = retryAfterMs || BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 500);

        log.warn("tbx request retrying", { method, path, status: res.status, attempt, backoffMs, requestId });
        await sleep(backoffMs);
      } catch (err) {
        if (err instanceof TbxProviderError) throw err;

        const isAbort = err instanceof Error && err.name === "AbortError";
        lastError = new TbxProviderError({
          message: isAbort
            ? `TBX ${method} ${path} timed out after ${REQUEST_TIMEOUT_MS}ms`
            : `TBX ${method} ${path} network error: ${err instanceof Error ? err.message : String(err)}`,
          code: isAbort ? "TIMEOUT" : "NETWORK_ERROR",
          retryable: true,
          requestId,
        });

        if (attempt > MAX_RETRIES) {
          log.error("tbx request exhausted retries", { method, path, code: lastError.code, attempt, requestId });
          throw lastError;
        }

        const backoffMs = BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 500);
        log.warn("tbx request retrying after network error", { method, path, attempt, backoffMs, requestId });
        await sleep(backoffMs);
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new TbxProviderError({ message: "TBX request failed" });
  }

  // -------------------------------------------------------------------------
  // Verification methods — endpoint paths are placeholders (see file header)
  // -------------------------------------------------------------------------

  private toDiagnostics(
    method: "GET" | "POST",
    path: string,
    res: { statusCode: number; headers: Record<string, string>; durationMs: number; retryCount: number }
  ) {
    return {
      endpoint: path,
      httpMethod: method,
      statusCode: res.statusCode,
      responseHeaders: res.headers,
      durationMs: res.durationMs,
      retryCount: res.retryCount,
    };
  }

  async verifyPan(input: VerifyPanInput): Promise<VerifyPanResult> {
    // Catalog: "Business PAN" / "Comprehensive PAN Details API"
    const path = "/v1/kyc/pan/verify";
    const res = await this.request<JsonRecord>("POST", path, { pan: input.pan, nameToMatch: input.nameToMatch });
    return {
      outcome: res.data.valid ? "VERIFIED" : "FAILED",
      referenceId: res.requestId,
      registeredName: typeof res.data.registeredName === "string" ? res.data.registeredName : undefined,
      nameMatchScore: typeof res.data.nameMatchScore === "number" ? res.data.nameMatchScore : undefined,
      panStatus: typeof res.data.panStatus === "string" ? res.data.panStatus : undefined,
      panType: typeof res.data.panType === "string" ? res.data.panType : undefined,
      raw: res.data,
      diagnostics: this.toDiagnostics("POST", path, res),
    };
  }

  async verifyGstin(input: VerifyGstinInput): Promise<VerifyGstinResult> {
    // Catalog: "GST Verification" / "GST Basic" / "GST Advance"
    const path = "/v1/kyc/gstin/verify";
    const res = await this.request<JsonRecord>("POST", path, { gstin: input.gstin });
    return {
      outcome: res.data.valid ? "VERIFIED" : "FAILED",
      referenceId: res.requestId,
      legalName: typeof res.data.legalName === "string" ? res.data.legalName : undefined,
      tradeName: typeof res.data.tradeName === "string" ? res.data.tradeName : undefined,
      gstinStatus: typeof res.data.status === "string" ? res.data.status : undefined,
      registrationDate: typeof res.data.registrationDate === "string" ? res.data.registrationDate : undefined,
      natureOfBusiness: Array.isArray(res.data.natureOfBusiness) ? (res.data.natureOfBusiness as string[]) : undefined,
      raw: res.data,
      diagnostics: this.toDiagnostics("POST", path, res),
    };
  }

  async verifyCin(input: VerifyCinInput): Promise<VerifyCinResult> {
    // Catalog: "CIN Number Lookup"
    const path = "/v1/kyc/cin/verify";
    const res = await this.request<JsonRecord>("POST", path, { cin: input.cin });
    return {
      outcome: res.data.found ? "VERIFIED" : "FAILED",
      referenceId: res.requestId,
      companyName: typeof res.data.companyName === "string" ? res.data.companyName : undefined,
      companyStatus: typeof res.data.companyStatus === "string" ? res.data.companyStatus : undefined,
      incorporationDate: typeof res.data.incorporationDate === "string" ? res.data.incorporationDate : undefined,
      companyType: typeof res.data.companyType === "string" ? res.data.companyType : undefined,
      raw: res.data,
      diagnostics: this.toDiagnostics("POST", path, res),
    };
  }

  async verifyAadhaar(input: VerifyAadhaarInput): Promise<VerifyAadhaarResult> {
    // Catalog: "Aadhaar Paperless Offline KYC (eKYC) API" / "Aadhaar OKYC API"
    const path = "/v1/kyc/aadhaar/okyc";
    const res = await this.request<JsonRecord>("POST", path, {
      offlineXml: input.offlineXmlBase64,
      shareCode: input.shareCode,
    });
    const aadhaarMasked = typeof res.data.maskedAadhaar === "string" ? res.data.maskedAadhaar : undefined;
    return {
      outcome: res.data.verified ? "VERIFIED" : "FAILED",
      referenceId: res.requestId,
      name: typeof res.data.name === "string" ? res.data.name : undefined,
      dob: typeof res.data.dob === "string" ? res.data.dob : undefined,
      gender: typeof res.data.gender === "string" ? res.data.gender : undefined,
      address: typeof res.data.address === "string" ? res.data.address : undefined,
      aadhaarLast4: aadhaarMasked ? aadhaarMasked.slice(-4) : undefined,
      raw: res.data,
      diagnostics: this.toDiagnostics("POST", path, res),
    };
  }

  async verifyBankAccount(input: VerifyBankAccountInput): Promise<VerifyBankAccountResult> {
    // Catalog: "Pennydrop BAV" / "Penniless BAV"
    const path = input.method === "PENNY_DROP" ? "/v1/bank/penny-drop" : "/v1/bank/penniless-bav";
    const res = await this.request<JsonRecord>("POST", path, {
      accountNumber: input.accountNumber,
      ifsc: input.ifsc,
      nameToMatch: input.nameToMatch,
    });
    return {
      outcome: res.data.verified ? "VERIFIED" : "FAILED",
      referenceId: res.requestId,
      verifiedAccountHolderName: typeof res.data.accountHolderName === "string" ? res.data.accountHolderName : undefined,
      nameMatchScore: typeof res.data.nameMatchScore === "number" ? res.data.nameMatchScore : undefined,
      bankName: typeof res.data.bankName === "string" ? res.data.bankName : undefined,
      branchName: typeof res.data.branchName === "string" ? res.data.branchName : undefined,
      raw: res.data,
      diagnostics: this.toDiagnostics("POST", path, res),
    };
  }

  async fetchDirector(input: FetchDirectorInput): Promise<FetchDirectorResult> {
    // Catalog: "Director Details (MCA DIN based)"
    const path = "/v1/kyc/director/din";
    const res = await this.request<JsonRecord>("POST", path, { din: input.din });
    return {
      outcome: res.data.found ? "VERIFIED" : "FAILED",
      referenceId: res.requestId,
      name: typeof res.data.name === "string" ? res.data.name : undefined,
      status: typeof res.data.status === "string" ? res.data.status : undefined,
      associatedCompanies: Array.isArray(res.data.associatedCompanies) ? (res.data.associatedCompanies as string[]) : undefined,
      raw: res.data,
      diagnostics: this.toDiagnostics("POST", path, res),
    };
  }

  async fetchCkyc(input: FetchCkycInput): Promise<FetchCkycResult> {
    // Catalog: "Simple CKYC Search & Download API" / "CKYC Search" / "CKYC Download"
    const path = "/v1/kyc/ckyc/search";
    const res = await this.request<JsonRecord>("POST", path, { pan: input.pan, ckycNumber: input.ckycNumber });
    return {
      outcome: res.data.found ? "VERIFIED" : "PENDING",
      referenceId: res.requestId,
      found: Boolean(res.data.found),
      ckycNumber: typeof res.data.ckycNumber === "string" ? res.data.ckycNumber : undefined,
      name: typeof res.data.name === "string" ? res.data.name : undefined,
      raw: res.data,
      diagnostics: this.toDiagnostics("POST", path, res),
    };
  }

  async screenAmlPep(input: ScreenAmlPepInput): Promise<ScreenAmlPepResult> {
    // Catalog: "Aml And Pep Verification (India)" / "(Global)"
    const path = "/v1/compliance/aml-pep/screen";
    const res = await this.request<JsonRecord>("POST", path, { name: input.name, pan: input.pan, dob: input.dob });
    return {
      outcome: res.data.isMatch ? "FAILED" : "VERIFIED", // a screening match is itself the "failure" outcome for KYC purposes
      referenceId: res.requestId,
      isMatch: Boolean(res.data.isMatch),
      riskLevel: (res.data.riskLevel as ScreenAmlPepResult["riskLevel"]) ?? undefined,
      matches: Array.isArray(res.data.matches) ? (res.data.matches as ScreenAmlPepResult["matches"]) : undefined,
      raw: res.data,
      diagnostics: this.toDiagnostics("POST", path, res),
    };
  }

  async createCustomer(input: CreateTbxCustomerInput): Promise<CreateTbxCustomerResult> {
    // Catalog: "Customer Onboarding" journey — registers a KYC/identity
    // profile. Deliberately NOT assumed to provision any account/payment
    // capability (out of Phase 1 scope) — only the identity/customer id.
    const path = "/v1/onboarding/customers";
    const res = await this.request<JsonRecord>("POST", path, {
      legalName: input.legalName,
      pan: input.pan,
      gstin: input.gstin,
      cin: input.cin,
      email: input.email,
      phone: input.phone,
    });
    const tbxCustomerId = typeof res.data.customerId === "string" ? res.data.customerId : "";
    if (!tbxCustomerId) {
      throw new TbxProviderError({
        message: "TBX createCustomer returned no customerId",
        code: "MALFORMED_RESPONSE",
        requestId: res.requestId,
      });
    }
    return {
      outcome: "PENDING", // customer creation is provisioning, not itself a pass/fail verification
      referenceId: res.requestId,
      tbxCustomerId,
      tbxOrganizationId: typeof res.data.organizationId === "string" ? res.data.organizationId : undefined,
      tbxStatus: typeof res.data.status === "string" ? res.data.status : undefined,
      raw: res.data,
      diagnostics: this.toDiagnostics("POST", path, res),
    };
  }
}
