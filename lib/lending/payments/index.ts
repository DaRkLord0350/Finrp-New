// ============================================================
// lib/lending/payments/index.ts
// Cached factory — mirrors lib/tbx/index.ts.
// ============================================================

import type { LoanPaymentProvider } from "./types";
import { LoanPaymentHttpProvider } from "./provider";
import { MockLoanPaymentProvider } from "./mock-provider";
import { isLoanPaymentMockMode } from "./config";

export * from "./types";
export { isLoanPaymentMockMode } from "./config";

let cached: LoanPaymentProvider | null = null;

export function getLoanPaymentProvider(): LoanPaymentProvider {
  if (cached) return cached;
  cached = isLoanPaymentMockMode() ? new MockLoanPaymentProvider() : new LoanPaymentHttpProvider();
  return cached;
}

/** Test hook — reset the cached provider so a test can force mock mode. */
export function resetLoanPaymentProviderCache(): void {
  cached = null;
}
