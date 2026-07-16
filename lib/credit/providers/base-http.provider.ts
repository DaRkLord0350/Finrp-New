// ============================================================
// lib/credit/providers/base-http.provider.ts
//
// Shared real-HTTP-client scaffold for all four bureaus — they are
// genuinely identical in shape (auth, timeout, retry/backoff,
// structured logging, and "no fabricated endpoint" honesty), differing
// only in which bureau's config/name they carry. One base class, four
// one-line subclasses (see ./experian.provider.ts etc.) rather than
// four copies of the same retry/timeout scaffolding.
// ============================================================

import { getBureauConfig, type Bureau } from "../config";
import { CreditEndpointNotBoundError, type CreditProvider, type PullCreditReportInput, type PullCreditReportResult } from "../types";

const MAX_RETRIES = 3;

/** Bounded retry+backoff+jitter, reserved for idempotent read calls once endpoints are bound. */
export async function withBureauRetry<T>(fn: () => Promise<T>, retryable: (err: unknown) => boolean): Promise<T> {
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

export abstract class BureauHttpProvider implements CreditProvider {
  protected abstract readonly bureauKey: Bureau;

  get name(): string {
    return `${this.bureauKey}_HTTP`;
  }
  get bureau(): "EXPERIAN" | "CIBIL" | "CRIF" | "EQUIFAX" {
    return this.bureauKey;
  }

  async pullReport(_input: PullCreditReportInput): Promise<PullCreditReportResult> {
    // Throws CreditConfigError first if env vars are missing, so
    // misconfiguration surfaces before the (currently unbound) call.
    getBureauConfig(this.bureauKey);
    return withBureauRetry(
      () => {
        throw new CreditEndpointNotBoundError(this.bureauKey, "pullReport");
      },
      () => false
    );
  }
}
