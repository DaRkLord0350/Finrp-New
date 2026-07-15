// ============================================================
// FinRP — TBX Statement Provider Registry
// Resolves the TbxStatementProvider implementation based on
// TBX_BANKING_MOCK_MODE. Mirrors lib/tbx/balance/index.ts.
// ============================================================

import type { TbxStatementProvider } from "./statement.types";
import { TbxStatementHttpClient, isTbxBankingMockMode } from "./statement.client";
import { MockTbxStatementProvider } from "./statement.mock";

export * from "./statement.types";
export { TbxStatementHttpClient } from "./statement.client";
export { MockTbxStatementProvider } from "./statement.mock";

let cached: TbxStatementProvider | null = null;

export function getTbxStatementProvider(): TbxStatementProvider {
  if (cached) return cached;
  cached = isTbxBankingMockMode() ? new MockTbxStatementProvider() : new TbxStatementHttpClient();
  return cached;
}
