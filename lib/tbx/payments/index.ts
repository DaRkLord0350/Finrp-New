// ============================================================
// FinRP — TBX Payment Provider Registry
// Resolves the TbxPaymentProvider implementation based on
// TBX_BANKING_MOCK_MODE. Mirrors lib/tbx/balance/index.ts's registry.
// ============================================================

import type { TbxPaymentProvider } from "./payment.types";
import { TbxPaymentHttpClient, isTbxBankingMockMode } from "./payment.client";
import { MockTbxPaymentProvider } from "./payment.mock";

export * from "./payment.types";
export { TbxPaymentHttpClient, isTbxBankingMockMode } from "./payment.client";
export { MockTbxPaymentProvider } from "./payment.mock";

let cached: TbxPaymentProvider | null = null;

export function getTbxPaymentProvider(): TbxPaymentProvider {
  if (cached) return cached;
  cached = isTbxBankingMockMode() ? new MockTbxPaymentProvider() : new TbxPaymentHttpClient();
  return cached;
}
