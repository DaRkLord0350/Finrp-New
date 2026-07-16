import { createHash } from "crypto";
import type { IpIntelligenceInput, IpIntelligenceProvider, IpIntelligenceResult } from "./types";

export class MockIpIntelligenceProvider implements IpIntelligenceProvider {
  readonly name = "IP_INTELLIGENCE_MOCK";

  async lookup(input: IpIntelligenceInput): Promise<IpIntelligenceResult> {
    const seed = parseInt(createHash("sha256").update(input.ipAddress).digest("hex").slice(0, 6), 16);
    const isVpn = seed % 10 === 0; // ~10% flagged, deterministic per IP
    return {
      outcome: "SUCCESS",
      riskScore: isVpn ? 70 + (seed % 30) : seed % 20,
      country: ["IN", "US", "GB", "SG", "AE"][seed % 5],
      isVpn,
      isProxy: false,
      isDatacenter: isVpn && seed % 3 === 0,
      raw: { mock: true, ipAddress: input.ipAddress },
    };
  }
}
