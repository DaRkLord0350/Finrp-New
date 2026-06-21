// ============================================================
// lib/tax/filing/factory.ts
//
// Selects the active FilingProvider from env. Defaults to the mock
// sandbox so the engine is fully functional without GSP credentials.
// Set GSP_PROVIDER=gstn (+ GSP_* creds) to go live.
// ============================================================

import type { FilingProvider } from "./provider";
import { MockFilingProvider } from "./providers/mock";
import { GstnStandardProvider } from "./providers/gstn-standard";

let cached: FilingProvider | null = null;

export function getFilingProvider(): FilingProvider {
  if (cached) return cached;
  const choice = (process.env.GSP_PROVIDER ?? "mock").toLowerCase();
  switch (choice) {
    case "gstn":
    case "gsp":
      cached = new GstnStandardProvider();
      break;
    case "mock":
    default:
      cached = new MockFilingProvider();
      break;
  }
  return cached;
}

/** Test/admin hook to override the provider. */
export function setFilingProvider(provider: FilingProvider | null): void {
  cached = provider;
}
