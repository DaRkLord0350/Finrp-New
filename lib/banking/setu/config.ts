// ============================================================
// FinRP Banking OS — Setu AA Configuration
// Single source of truth for Setu environment configuration.
// Maps SETU_AA_ENV → base URL and validates required secrets at
// first use (fail-fast with an actionable error message).
//
// Required environment variables:
//   SETU_AA_ENV               "sandbox" | "production"
//   SETU_CLIENT_ID
//   SETU_SECRET               (legacy alias: SETU_CLIENT_SECRET)
//   SETU_PRODUCT_INSTANCE_ID
//   SETU_WEBHOOK_SECRET       (required in production, warned in sandbox)
//
// Optional:
//   SETU_AA_BASE_URL          explicit base URL override
//   NEXT_PUBLIC_APP_URL       used to build the consent redirect URL
// ============================================================

const SETU_BASE_URLS: Record<string, string> = {
  sandbox: "https://fiu-sandbox.setu.co",
  production: "https://fiu.setu.co",
};

export type SetuEnv = "sandbox" | "production";

export interface SetuConfig {
  env: SetuEnv;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  productInstanceId: string;
  webhookSecret: string | null;
  appUrl: string;
}

export class SetuConfigError extends Error {
  constructor(missing: string[]) {
    super(
      `Setu AA is not configured — missing environment variable(s): ${missing.join(", ")}. ` +
      `Set them in .env.local (see BANKING_SETU_AUDIT.md §5).`
    );
    this.name = "SetuConfigError";
  }
}

/**
 * Reads and validates Setu configuration from the environment.
 * Throws SetuConfigError when a required variable is missing so
 * misconfiguration surfaces as a clear 500 instead of a silent 401
 * from Setu with empty credentials.
 */
export function getSetuConfig(): SetuConfig {
  const env = (process.env.SETU_AA_ENV ?? "sandbox").toLowerCase() as SetuEnv;
  const clientId = process.env.SETU_CLIENT_ID ?? "";
  // SETU_SECRET is canonical; SETU_CLIENT_SECRET kept as a legacy fallback.
  const clientSecret = process.env.SETU_SECRET ?? process.env.SETU_CLIENT_SECRET ?? "";
  const productInstanceId = process.env.SETU_PRODUCT_INSTANCE_ID ?? "";
  const webhookSecret = process.env.SETU_WEBHOOK_SECRET || null;

  const missing: string[] = [];
  if (!clientId) missing.push("SETU_CLIENT_ID");
  if (!clientSecret) missing.push("SETU_SECRET");
  if (!productInstanceId) missing.push("SETU_PRODUCT_INSTANCE_ID");
  if (env === "production" && !webhookSecret) missing.push("SETU_WEBHOOK_SECRET");
  if (missing.length > 0) throw new SetuConfigError(missing);

  const baseUrl =
    process.env.SETU_AA_BASE_URL ??
    SETU_BASE_URLS[env] ??
    SETU_BASE_URLS.sandbox;

  return {
    env: env === "production" ? "production" : "sandbox",
    baseUrl,
    clientId,
    clientSecret,
    productInstanceId,
    webhookSecret,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  };
}

/** True when all required Setu variables are present (no throw). */
export function isSetuConfigured(): boolean {
  try {
    getSetuConfig();
    return true;
  } catch {
    return false;
  }
}
