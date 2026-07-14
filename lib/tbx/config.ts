// ============================================================
// FinRP — TBX (TransBnk) Configuration
// Mirrors lib/banking/setu/config.ts's fail-fast pattern, with one
// addition: TBX_MOCK_MODE, since no real TBX credentials or API
// documentation exist yet (see docs/TBX_FOUNDATION.md §14). When
// mock mode is on, lib/tbx/index.ts serves MockTbxProvider instead
// of the real HTTP client — config is still read so the plumbing
// behaves identically once real credentials arrive.
//
// Environment variables:
//   TBX_MOCK_MODE          "true" to use the deterministic mock provider
//   TBX_ENV                "sandbox" | "production"
//   TBX_BASE_URL           explicit base URL override
//   TBX_CLIENT_ID          )
//   TBX_CLIENT_SECRET      ) auth mechanism unconfirmed — placeholders
//   TBX_API_KEY            ) until real TBX API docs are available
// ============================================================

export type TbxEnv = "sandbox" | "production";

const TBX_BASE_URLS: Record<TbxEnv, string> = {
  // Placeholders — TBX has not published sandbox/production base URLs to
  // this codebase. Update once real API documentation is available.
  sandbox: "https://sandbox.tbx.co.in",
  production: "https://api.tbx.co.in",
};

export interface TbxConfig {
  mockMode: boolean;
  env: TbxEnv;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  apiKey: string;
}

export class TbxConfigError extends Error {
  constructor(missing: string[]) {
    super(
      `TBX is not configured — missing environment variable(s): ${missing.join(", ")}. ` +
        `Set TBX_MOCK_MODE=true for development, or configure real TBX credentials.`
    );
    this.name = "TbxConfigError";
  }
}

export function isTbxMockMode(): boolean {
  return (process.env.TBX_MOCK_MODE ?? "").toLowerCase() === "true";
}

/**
 * Reads TBX configuration from the environment. Throws TbxConfigError when
 * required variables are missing and mock mode is off, so misconfiguration
 * surfaces as a clear error instead of a silent failure against an unset
 * base URL.
 */
export function getTbxConfig(): TbxConfig {
  const mockMode = isTbxMockMode();
  const env = (process.env.TBX_ENV ?? "sandbox").toLowerCase() as TbxEnv;
  const clientId = process.env.TBX_CLIENT_ID ?? "";
  const clientSecret = process.env.TBX_CLIENT_SECRET ?? "";
  const apiKey = process.env.TBX_API_KEY ?? "";

  if (!mockMode) {
    const missing: string[] = [];
    if (!clientId && !apiKey) missing.push("TBX_CLIENT_ID (or TBX_API_KEY)");
    if (!clientSecret && !apiKey) missing.push("TBX_CLIENT_SECRET (or TBX_API_KEY)");
    if (missing.length > 0) throw new TbxConfigError(missing);
  }

  const baseUrl =
    process.env.TBX_BASE_URL ??
    TBX_BASE_URLS[env === "production" ? "production" : "sandbox"];

  return {
    mockMode,
    env: env === "production" ? "production" : "sandbox",
    baseUrl,
    clientId,
    clientSecret,
    apiKey,
  };
}
