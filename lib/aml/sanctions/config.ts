// ============================================================
// lib/aml/sanctions/config.ts
//
// Feed URLs are read from env, never hardcoded — OFAC and the UN
// have both changed their publication endpoints over time, and
// asserting a specific URL as current-and-correct without being able
// to verify it live would be exactly the kind of unverified external
// claim this codebase's other providers (TBX, Credit Bureau) are
// deliberately built to avoid. The operator points these at
// whichever current URL OFAC (https://ofac.treasury.gov) and the UN
// (https://www.un.org/securitycouncil/sanctions) publish.
// ============================================================

export type SanctionsFeedSource = "OFAC_SDN" | "UN_CONSOLIDATED";

export class SanctionsFeedNotConfiguredError extends Error {
  constructor(source: SanctionsFeedSource, envVar: string) {
    super(
      `${source} feed URL is not configured — set ${envVar} to the current XML feed URL published by the source ` +
        `(OFAC: https://ofac.treasury.gov, UN: https://www.un.org/securitycouncil/sanctions). These endpoints are ` +
        `not hardcoded because they can change; verify the current URL before setting it.`
    );
    this.name = "SanctionsFeedNotConfiguredError";
  }
}

export function getSanctionsFeedUrl(source: SanctionsFeedSource): string {
  const envVar = source === "OFAC_SDN" ? "OFAC_SDN_FEED_URL" : "UN_CONSOLIDATED_FEED_URL";
  const url = process.env[envVar];
  if (!url) throw new SanctionsFeedNotConfiguredError(source, envVar);
  return url;
}
