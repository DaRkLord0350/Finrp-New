import { IpIntelligenceEndpointNotBoundError, IpIntelligenceNotConfiguredError, type IpIntelligenceInput, type IpIntelligenceProvider, type IpIntelligenceResult } from "./types";

function assertConfigured() {
  if (!process.env.IP_INTELLIGENCE_BASE_URL || !process.env.IP_INTELLIGENCE_API_KEY) throw new IpIntelligenceNotConfiguredError();
}

export class IpIntelligenceHttpProvider implements IpIntelligenceProvider {
  readonly name = "IP_INTELLIGENCE_HTTP";
  async lookup(_input: IpIntelligenceInput): Promise<IpIntelligenceResult> {
    assertConfigured();
    throw new IpIntelligenceEndpointNotBoundError("lookup");
  }
}
