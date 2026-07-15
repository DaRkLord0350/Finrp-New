// ============================================================
// FinRP — TBX Beneficiary Provider Registry
// Resolves the TbxBeneficiaryProvider implementation based on
// TBX_BANKING_MOCK_MODE. Mirrors lib/tbx/balance/index.ts's registry.
// ============================================================

import type { TbxBeneficiaryProvider } from "./beneficiary.types";
import { TbxBeneficiaryHttpClient, isTbxBankingMockMode } from "./beneficiary.client";
import { MockTbxBeneficiaryProvider } from "./beneficiary.mock";

export * from "./beneficiary.types";
export { TbxBeneficiaryHttpClient, isTbxBankingMockMode } from "./beneficiary.client";
export { MockTbxBeneficiaryProvider } from "./beneficiary.mock";

let cached: TbxBeneficiaryProvider | null = null;

export function getTbxBeneficiaryProvider(): TbxBeneficiaryProvider {
  if (cached) return cached;
  cached = isTbxBankingMockMode() ? new MockTbxBeneficiaryProvider() : new TbxBeneficiaryHttpClient();
  return cached;
}
