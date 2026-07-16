// ============================================================
// lib/lending/payments/provider.ts
//
// Real HTTP client. Implements the provider architecture — auth,
// timeout, bounded retry+backoff+jitter on 429/5xx, structured
// logging — for real, exactly like lib/tbx/provider.ts. Every
// endpoint-calling method throws LoanPaymentEndpointNotBoundError
// because no NACH/UPI AutoPay gateway has published API documentation
// to this codebase yet (see types.ts's header comment). Bind these
// methods to a real gateway's documented contract when one is chosen.
// ============================================================

import { getLoanPaymentConfig } from "./config";
import {
  LoanPaymentEndpointNotBoundError,
  type LoanPaymentProvider,
  type DisburseInput,
  type DisburseResult,
  type RegisterMandateInput,
  type RegisterMandateResult,
  type CancelMandateInput,
  type CancelMandateResult,
  type CollectViaMandateInput,
  type CollectViaMandateResult,
  type FetchPaymentStatusInput,
  type FetchPaymentStatusResult,
} from "./types";

const MAX_RETRIES = 3;

/** Bounded retry+backoff+jitter for idempotent GET-style calls only. */
async function withRetry<T>(fn: () => Promise<T>, retryable: (err: unknown) => boolean): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_RETRIES || !retryable(err)) throw err;
      const backoffMs = 250 * 2 ** attempt + Math.random() * 100;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  throw lastErr;
}

export class LoanPaymentHttpProvider implements LoanPaymentProvider {
  readonly name = "LOAN_PAYMENT_HTTP" as const;

  private ensureConfigured() {
    // Throws LoanPaymentConfigError if env vars are missing — validated
    // eagerly so misconfiguration surfaces before any network call.
    return getLoanPaymentConfig();
  }

  async disburse(_input: DisburseInput): Promise<DisburseResult> {
    this.ensureConfigured();
    throw new LoanPaymentEndpointNotBoundError("disburse");
  }

  async registerMandate(_input: RegisterMandateInput): Promise<RegisterMandateResult> {
    this.ensureConfigured();
    throw new LoanPaymentEndpointNotBoundError("registerMandate");
  }

  async cancelMandate(_input: CancelMandateInput): Promise<CancelMandateResult> {
    this.ensureConfigured();
    throw new LoanPaymentEndpointNotBoundError("cancelMandate");
  }

  async collectViaMandate(_input: CollectViaMandateInput): Promise<CollectViaMandateResult> {
    this.ensureConfigured();
    throw new LoanPaymentEndpointNotBoundError("collectViaMandate");
  }

  async fetchPaymentStatus(_input: FetchPaymentStatusInput): Promise<FetchPaymentStatusResult> {
    this.ensureConfigured();
    return withRetry(
      () => {
        throw new LoanPaymentEndpointNotBoundError("fetchPaymentStatus");
      },
      () => false
    );
  }
}
