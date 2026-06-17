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

/** Callback path appended to whichever origin we resolve. */
const CALLBACK_PATH = "/api/oauth/zoho/callback";

/**
 * Resolves the redirect URI used for BOTH the authorization request and the
 * token exchange. They MUST be byte-identical to each other and to a URI
 * registered in the Zoho API Console, otherwise Zoho returns
 * "Invalid Redirect Uri".
 *
 * Resolution priority:
 *   1. (dev only) the live request origin — so the flow works on
 *      http://localhost:3000 (or any preview host) without editing the
 *      production ZOHO_REDIRECT_URI. The same request handles auth + callback,
 *      so the value is guaranteed consistent across the round-trip.
 *   2. ZOHO_REDIRECT_URI env var — the explicit, pinned production canonical
 *      URL. Most reliable behind proxies where request.url is unreliable.
 *   3. NEXT_PUBLIC_APP_URL + callback path (fallback).
 *   4. http://localhost:3000 + callback path (dev last resort).
 *
 * NOTE: each origin you actually serve the app from (localhost AND the
 * production domain) must be registered as an Authorized Redirect URI in the
 * Zoho API Console for that exact client.
 */
export function resolveRedirectUri(req?: Request): string {
  // 1. In non-production, derive from the request origin so local dev and
  //    preview deployments "just work" against their own callback host.
  if (process.env.NODE_ENV !== "production" && req) {
    try {
      const origin = new URL(req.url).origin;
      if (origin) return `${origin}${CALLBACK_PATH}`;
    } catch {
      /* fall through to env-based resolution */
    }
  }

  // 2. Production canonical (explicit, most reliable).
  if (process.env.ZOHO_REDIRECT_URI?.trim()) {
    return process.env.ZOHO_REDIRECT_URI.trim();
  }
  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    return `${process.env.NEXT_PUBLIC_APP_URL.trim()}${CALLBACK_PATH}`;
  }
  return `http://localhost:3000${CALLBACK_PATH}`;
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
