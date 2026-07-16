import type { IpIntelligenceProvider } from "./types";
import { IpIntelligenceHttpProvider } from "./provider";
import { MockIpIntelligenceProvider } from "./mock-provider";

export * from "./types";

let cached: IpIntelligenceProvider | null = null;

export function getIpIntelligenceProvider(): IpIntelligenceProvider {
  if (cached) return cached;
  cached = process.env.IP_INTELLIGENCE_MOCK_MODE === "true" ? new MockIpIntelligenceProvider() : new IpIntelligenceHttpProvider();
  return cached;
}

export function resetIpIntelligenceProviderCache(): void {
  cached = null;
}
