// ============================================================
// Zoho OAuth — Configuration Validator
// Validates all required env vars before any OAuth request.
// Returns structured diagnostics without exposing secrets.
// ============================================================

export interface ZohoConfigDiagnostics {
  hasClientId: boolean;
  clientIdPrefix: string | undefined;
  hasClientSecret: boolean;
  clientSecretLength: number | undefined;
  hasRedirectUri: boolean;
  redirectUri: string | undefined;
  hasEncryptionKey: boolean;
  valid: boolean;
  errors: string[];
}

// Known data center → accounts-server host mapping
const ACCOUNTS_SERVER_MAP: Record<string, string> = {
  IN: "accounts.zoho.in",
  US: "accounts.zoho.com",
  EU: "accounts.zoho.eu",
  AU: "accounts.zoho.com.au",
  JP: "accounts.zoho.jp",
  CN: "accounts.zoho.com.cn",
};

// Reverse map: accounts-server host → DC code
const HOST_TO_DC: Record<string, string> = Object.fromEntries(
  Object.entries(ACCOUNTS_SERVER_MAP).map(([dc, host]) => [host, dc])
);

export function getDiagnostics(): ZohoConfigDiagnostics {
  const clientId = process.env.ZOHO_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOHO_CLIENT_SECRET?.trim();
  const redirectUri = process.env.ZOHO_REDIRECT_URI?.trim();
  const encryptionKey = process.env.ENCRYPTION_KEY?.trim();
  const errors: string[] = [];

  if (!clientId) {
    errors.push("ZOHO_CLIENT_ID is not set");
  }
  if (!clientSecret) {
    errors.push(
      "ZOHO_CLIENT_SECRET is not set — verify env var name is UPPERCASE (common mistake: zoho_client_secret)"
    );
  }
  if (!redirectUri) {
    errors.push("ZOHO_REDIRECT_URI is not set");
  }
  if (!encryptionKey) {
    errors.push("ENCRYPTION_KEY is not set");
  }

  return {
    hasClientId: !!clientId,
    clientIdPrefix: clientId?.substring(0, 10),
    hasClientSecret: !!clientSecret,
    clientSecretLength: clientSecret?.length,
    hasRedirectUri: !!redirectUri,
    redirectUri,
    hasEncryptionKey: !!encryptionKey,
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Resolves the canonical redirect URI in priority order:
 *   1. ZOHO_REDIRECT_URI env var (explicit, most reliable)
 *   2. NEXT_PUBLIC_APP_URL + /api/oauth/zoho/callback (fallback)
 *   3. http://localhost:3000/api/oauth/zoho/callback (dev-only last resort)
 */
export function resolveRedirectUri(): string {
  if (process.env.ZOHO_REDIRECT_URI?.trim()) {
    return process.env.ZOHO_REDIRECT_URI.trim();
  }
  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    return `${process.env.NEXT_PUBLIC_APP_URL.trim()}/api/oauth/zoho/callback`;
  }
  return "http://localhost:3000/api/oauth/zoho/callback";
}

/**
 * Infers the DC code from the accounts-server URL Zoho passes in the callback.
 * e.g. "https://accounts.zoho.in" → "IN"
 */
export function dataCenterFromAccountsServer(accountsServer: string | null): string | null {
  if (!accountsServer) return null;
  try {
    const host = new URL(accountsServer).hostname;
    return HOST_TO_DC[host] ?? null;
  } catch {
    return null;
  }
}

export class OAuthConfigValidator {
  static validate(): ZohoConfigDiagnostics {
    return getDiagnostics();
  }

  /** Throws with structured error if config is invalid. */
  static assert(): void {
    const diag = getDiagnostics();
    if (!diag.valid) {
      console.error("[ZohoConfig] Configuration validation failed:", {
        hasClientId: diag.hasClientId,
        clientIdPrefix: diag.clientIdPrefix,
        hasClientSecret: diag.hasClientSecret,
        clientSecretLength: diag.clientSecretLength,
        hasRedirectUri: diag.hasRedirectUri,
        redirectUri: diag.redirectUri,
        hasEncryptionKey: diag.hasEncryptionKey,
        errors: diag.errors,
      });
      throw new Error(`Zoho OAuth misconfigured: ${diag.errors.join("; ")}`);
    }
  }
}
