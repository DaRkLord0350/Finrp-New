// ============================================================
// FinRP Banking OS — Provider Registry
// Resolves the BankingProvider implementation for an AAProvider.
// New providers (Finbox, OneMoney, ...) plug in here without
// touching call sites.
// ============================================================

import type { AAProvider } from "@prisma/client";
import type { BankingProvider } from "./types";
import { SetuProvider } from "./setu.provider";

export * from "./types";
export { SetuProvider } from "./setu.provider";

const registry = new Map<AAProvider, BankingProvider>();

export function getBankingProvider(name: AAProvider = "SETU"): BankingProvider {
  const cached = registry.get(name);
  if (cached) return cached;

  let provider: BankingProvider;
  switch (name) {
    case "SETU":
      provider = new SetuProvider();
      break;
    default:
      throw new Error(`No BankingProvider implementation registered for "${name}"`);
  }

  registry.set(name, provider);
  return provider;
}
