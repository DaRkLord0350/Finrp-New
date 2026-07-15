// ============================================================
// FinRP — MockTbxBalanceProvider
//
// Deterministic canned balances for development/tests, since TBX
// has provided no sandbox credentials or test environment for its
// Balance API. Kept as a fully separate implementation of
// TbxBalanceProvider (not `if (mock)` branches inside the real
// client) — selected via lib/tbx/balance/index.ts's registry based
// on TBX_BANKING_MOCK_MODE. Mirrors lib/tbx/mock-provider.ts's
// convention.
// ============================================================

import type { FetchBalancesInput, FetchBalancesResult, TbxBalanceProvider } from "./balance.types";

/** Deterministic per-account "randomness" so repeated syncs move slightly but predictably. */
function pseudoRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 10_000) / 10_000; // 0..1
}

export class MockTbxBalanceProvider implements TbxBalanceProvider {
  readonly name = "TBX_BALANCE_MOCK" as const;

  async fetchBalances(input: FetchBalancesInput): Promise<FetchBalancesResult> {
    const seed = `${input.bankAccountId}:${new Date().toISOString().slice(0, 10)}`;
    const r = pseudoRandom(seed);

    const base = 100_000 + Math.floor(r * 900_000); // ₹1L - ₹10L
    const currentBalance = base;
    const availableBalance = Math.max(0, base - Math.floor(r * 25_000)); // holds/liens
    const ledgerBalance = base + Math.floor((1 - r) * 15_000); // uncleared credits

    return {
      outcome: "SUCCESS",
      currentBalance,
      availableBalance,
      ledgerBalance,
      currency: "INR",
      asOf: new Date(),
      raw: { mock: true, bankAccountId: input.bankAccountId, currentBalance, availableBalance, ledgerBalance },
    };
  }
}
