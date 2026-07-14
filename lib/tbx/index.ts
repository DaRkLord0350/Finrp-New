// ============================================================
// FinRP — TBX Provider Registry
// Resolves the TbxProvider implementation based on TBX_MOCK_MODE.
// Mirrors lib/banking/providers/index.ts's registry pattern.
// ============================================================

import type { TbxProvider } from "./types";
import { TbxHttpProvider } from "./provider";
import { MockTbxProvider } from "./mock-provider";
import { isTbxMockMode } from "./config";

export * from "./types";
export { TbxHttpProvider } from "./provider";
export { MockTbxProvider } from "./mock-provider";

let cached: TbxProvider | null = null;

export function getTbxProvider(): TbxProvider {
  if (cached) return cached;
  cached = isTbxMockMode() ? new MockTbxProvider() : new TbxHttpProvider();
  return cached;
}
