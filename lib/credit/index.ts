// ============================================================
// lib/credit/index.ts
// Cached per-bureau factory — mirrors lib/tbx/index.ts.
// ============================================================

import type { Bureau } from "./config";
import { isBureauMockMode } from "./config";
import type { CreditProvider } from "./types";
import { MockCreditProvider } from "./providers/mock.provider";
import { ExperianProvider } from "./providers/experian.provider";
import { CIBILProvider } from "./providers/cibil.provider";
import { CRIFProvider } from "./providers/crif.provider";
import { EquifaxProvider } from "./providers/equifax.provider";

export * from "./types";
export type { Bureau } from "./config";

const cache = new Map<Bureau, CreditProvider>();

const HTTP_PROVIDERS: Record<Bureau, () => CreditProvider> = {
  EXPERIAN: () => new ExperianProvider(),
  CIBIL: () => new CIBILProvider(),
  CRIF: () => new CRIFProvider(),
  EQUIFAX: () => new EquifaxProvider(),
};

export function getCreditProvider(bureau: Bureau): CreditProvider {
  const cached = cache.get(bureau);
  if (cached) return cached;

  const provider = isBureauMockMode(bureau) ? new MockCreditProvider(bureau) : HTTP_PROVIDERS[bureau]();
  cache.set(bureau, provider);
  return provider;
}

/** Test hook — reset the cache so a test can force mock mode per bureau. */
export function resetCreditProviderCache(): void {
  cache.clear();
}
