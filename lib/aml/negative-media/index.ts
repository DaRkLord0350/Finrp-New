import type { NegativeMediaProvider } from "./types";
import { NegativeMediaHttpProvider } from "./provider";
import { MockNegativeMediaProvider } from "./mock-provider";

export * from "./types";

let cached: NegativeMediaProvider | null = null;

export function getNegativeMediaProvider(): NegativeMediaProvider {
  if (cached) return cached;
  cached = process.env.NEGATIVE_MEDIA_MOCK_MODE === "true" ? new MockNegativeMediaProvider() : new NegativeMediaHttpProvider();
  return cached;
}

export function resetNegativeMediaProviderCache(): void {
  cached = null;
}
