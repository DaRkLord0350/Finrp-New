// ============================================================
// FinRP — TBX Balance Provider Registry
// Resolves the TbxBalanceProvider implementation based on
// TBX_BANKING_MOCK_MODE. Mirrors lib/tbx/index.ts's registry pattern.
// ============================================================

import type { TbxBalanceProvider } from "./balance.types";
import { TbxBalanceHttpClient, isTbxBankingMockMode } from "./balance.client";
import { MockTbxBalanceProvider } from "./balance.mock";

export * from "./balance.types";
export { TbxBalanceHttpClient, getTbxBankingConfig, isTbxBankingMockMode } from "./balance.client";
export { MockTbxBalanceProvider } from "./balance.mock";

let cached: TbxBalanceProvider | null = null;

export function getTbxBalanceProvider(): TbxBalanceProvider {
  if (cached) return cached;
  cached = isTbxBankingMockMode() ? new MockTbxBalanceProvider() : new TbxBalanceHttpClient();
  return cached;
}
