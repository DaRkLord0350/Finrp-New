// ============================================================
// lib/credit/config.ts
// Fail-fast, per-bureau env readers — mirrors lib/tbx/config.ts.
// ============================================================

export type Bureau = "EXPERIAN" | "CIBIL" | "CRIF" | "EQUIFAX";

export interface BureauConfig {
  baseUrl: string;
  clientId: string;
  apiKey: string;
}

export class CreditConfigError extends Error {
  constructor(bureau: Bureau, missing: string[]) {
    super(
      `${bureau} is not configured — missing env var(s): ${missing.join(", ")}. ` +
        `Set ${bureau}_MOCK_MODE=true for development instead.`
    );
    this.name = "CreditConfigError";
  }
}

export function isBureauMockMode(bureau: Bureau): boolean {
  return process.env[`${bureau}_MOCK_MODE`] === "true";
}

export function getBureauConfig(bureau: Bureau): BureauConfig {
  const baseUrl = process.env[`${bureau}_BASE_URL`];
  const clientId = process.env[`${bureau}_CLIENT_ID`];
  const apiKey = process.env[`${bureau}_API_KEY`];

  const missing: string[] = [];
  if (!baseUrl) missing.push(`${bureau}_BASE_URL`);
  if (!clientId) missing.push(`${bureau}_CLIENT_ID`);
  if (!apiKey) missing.push(`${bureau}_API_KEY`);
  if (missing.length > 0) throw new CreditConfigError(bureau, missing);

  return { baseUrl: baseUrl!, clientId: clientId!, apiKey: apiKey! };
}
