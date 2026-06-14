// ============================================================
// FinRP — Zoho OAuth 2.0
// Handles full OAuth lifecycle: initiate, callback, refresh.
// Tokens stored encrypted in oauth_tokens table.
// Supports all Zoho data centers: IN, US, EU, AU, JP, CN.
// ============================================================

import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto/token-encryption";
import { resolveRedirectUri } from "@/lib/connectors/zoho/config-validator";

// ---------------------------------------------------------------------------
// Zoho data-center base URLs
// ---------------------------------------------------------------------------
export const DC_ACCOUNTS_URL: Record<string, string> = {
  IN: "https://accounts.zoho.in",
  US: "https://accounts.zoho.com",
  EU: "https://accounts.zoho.eu",
  AU: "https://accounts.zoho.com.au",
  JP: "https://accounts.zoho.jp",
  CN: "https://accounts.zoho.com.cn",
};

export const DC_API_URL: Record<string, string> = {
  IN: "https://www.zohoapis.in",
  US: "https://www.zohoapis.com",
  EU: "https://www.zohoapis.eu",
  AU: "https://www.zohoapis.com.au",
  JP: "https://www.zohoapis.jp",
  CN: "https://www.zohoapis.com.cn",
};

// ---------------------------------------------------------------------------
// Dynamic scope builder based on selected modules
// ---------------------------------------------------------------------------
export function buildOAuthScopes(modules: {
  crm: boolean;
  books: boolean;
  inventory: boolean;
}): string {
  const scopes: string[] = [];

  if (modules.crm) {
    scopes.push("ZohoCRM.modules.ALL", "ZohoCRM.settings.ALL");
  }

  if (modules.books) {
    scopes.push("ZohoBooks.fullaccess.ALL");
  }

  if (modules.inventory) {
    scopes.push("ZohoInventory.fullaccess.ALL");
  }

  scopes.push("offline_access");
  return scopes.join(",");
}

// ---------------------------------------------------------------------------
// State management — encode/decode OAuth state parameter
// ---------------------------------------------------------------------------
interface OAuthState {
  organizationId: string;
  integrationId: string;
  dataCenter: string;
  nonce: string;
  modules: {
    crm: boolean;
    books: boolean;
    inventory: boolean;
  };
}

export function encodeState(state: OAuthState): string {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

export function decodeState(encoded: string): OAuthState {
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthState;
  } catch {
    throw new Error("Invalid OAuth state parameter");
  }
}

// ---------------------------------------------------------------------------
// Build authorization URL
// ---------------------------------------------------------------------------
export function buildAuthorizationUrl(params: {
  organizationId: string;
  integrationId: string;
  dataCenter: string;
  clientId: string;
  redirectUri: string;
  modules: {
    crm: boolean;
    books: boolean;
    inventory: boolean;
  };
}): string {
  const { organizationId, integrationId, dataCenter, clientId, redirectUri, modules } = params;
  const dc = dataCenter.toUpperCase();
  const base = DC_ACCOUNTS_URL[dc] ?? DC_ACCOUNTS_URL.US;

  const state = encodeState({
    organizationId,
    integrationId,
    dataCenter: dc,
    nonce: Math.random().toString(36).slice(2),
    modules,
  });

  const url = new URL(`${base}/oauth/v2/auth`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", buildOAuthScopes(modules));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "consent");

  return url.toString();
}

// ---------------------------------------------------------------------------
// Token exchange response shape
// ---------------------------------------------------------------------------
export interface ZohoTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
  api_domain: string;
}

// ---------------------------------------------------------------------------
// Human-readable probable cause for each Zoho error code
// ---------------------------------------------------------------------------
function getProbableCause(error: string): string {
  switch (error) {
    case "invalid_client_secret":
      return (
        "ZOHO_CLIENT_SECRET is wrong, empty, or was passed as an encrypted blob. " +
        "Check: (1) env var name is UPPERCASE 'ZOHO_CLIENT_SECRET', " +
        "(2) value matches the secret in Zoho API Console, " +
        "(3) if re-connecting, the stored clientSecretEncrypted is being decrypted before use."
      );
    case "invalid_client":
      return "ZOHO_CLIENT_ID is incorrect or does not belong to this Zoho DC.";
    case "invalid_code":
      return "Authorization code was already used or has expired (each code is single-use).";
    case "redirect_uri_mismatch":
      return (
        "redirect_uri in token exchange does not match the one registered in Zoho API Console " +
        "or the one sent in the authorization request. All three must be identical."
      );
    case "access_denied":
      return "User denied access or the client lacks permission for the requested scopes.";
    default:
      return `Unknown Zoho error '${error}' — check Zoho API Console for app status.`;
  }
}

// ---------------------------------------------------------------------------
// Exchange authorization code for tokens
// ---------------------------------------------------------------------------
export async function exchangeCodeForTokens(params: {
  code: string;
  dataCenter: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<ZohoTokenResponse> {
  const { code, dataCenter, clientId, clientSecret, redirectUri } = params;
  const dc = dataCenter.toUpperCase();
  const base = DC_ACCOUNTS_URL[dc] ?? DC_ACCOUNTS_URL.US;
  const tokenUrl = `${base}/oauth/v2/token`;

  console.log("[ZohoOAuth] exchangeCodeForTokens →", {
    tokenUrl,
    dataCenter: dc,
    hasClientId: !!clientId,
    clientIdPrefix: clientId?.substring(0, 10),
    hasClientSecret: !!clientSecret,
    clientSecretLength: clientSecret?.length,
    redirectUri,
    codeLength: code?.length,
  });

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const responseText = await res.text();

  if (!res.ok) {
    console.error("[ZohoOAuth] Token exchange HTTP error:", {
      status: res.status,
      body: responseText,
      tokenUrl,
      dataCenter: dc,
    });
    throw new Error(`Zoho token exchange failed (${res.status}): ${responseText}`);
  }

  let data: ZohoTokenResponse & { error?: string };
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`Zoho token exchange returned non-JSON (${res.status}): ${responseText}`);
  }

  if (data.error) {
    const structured = {
      error: "ZOHO_TOKEN_EXCHANGE_FAILED",
      zohoError: data.error,
      probableCause: getProbableCause(data.error),
      dataCenter: dc,
      tokenUrl,
      redirectUri,
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      clientSecretLength: clientSecret?.length,
    };
    console.error("[ZohoOAuth] Token exchange error:", structured);
    throw new Error(JSON.stringify(structured));
  }

  console.log("[ZohoOAuth] Token exchange succeeded:", {
    dataCenter: dc,
    hasAccessToken: !!data.access_token,
    hasRefreshToken: !!data.refresh_token,
    expiresIn: data.expires_in,
  });

  return data;
}

// ---------------------------------------------------------------------------
// Refresh access token — BUG FIXED: reads clientSecretEncrypted + decrypts
// ---------------------------------------------------------------------------
export async function refreshZohoAccessToken(integrationId: string): Promise<string> {
  const tokenRecord = await prisma.oAuthToken.findUnique({
    where: { integrationId },
    include: { integration: true },
  });

  if (!tokenRecord) throw new Error(`No OAuth token found for integration ${integrationId}`);
  if (!tokenRecord.refreshToken) throw new Error("No refresh token available");

  const config = tokenRecord.integration.config as {
    dataCenter?: string;
    clientId?: string;
    clientSecretEncrypted?: string; // correct field name — was wrongly "clientSecret"
  } | null;

  const clientId = config?.clientId?.trim() ?? process.env.ZOHO_CLIENT_ID?.trim() ?? "";

  // FIXED: was reading config.clientSecret (non-existent); must decrypt clientSecretEncrypted
  const clientSecret = config?.clientSecretEncrypted
    ? decrypt(config.clientSecretEncrypted)
    : process.env.ZOHO_CLIENT_SECRET?.trim() ?? "";

  if (!clientId || !clientSecret) {
    throw new Error(
      `Zoho refresh failed for ${integrationId}: client credentials unavailable. ` +
        "Ensure ZOHO_CLIENT_SECRET is set or the integration has clientSecretEncrypted in config."
    );
  }

  const dc = config?.dataCenter?.toUpperCase() ?? "US";
  const base = DC_ACCOUNTS_URL[dc] ?? DC_ACCOUNTS_URL.US;
  const refreshToken = decrypt(tokenRecord.refreshToken);

  console.log("[ZohoOAuth] refreshZohoAccessToken →", {
    integrationId,
    dataCenter: dc,
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    usingStoredSecret: !!config?.clientSecretEncrypted,
  });

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const res = await fetch(`${base}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Zoho token refresh failed (${res.status}): ${errText}`);
  }

  const data = await res.json() as { access_token?: string; error?: string; expires_in?: number };

  if (data.error || !data.access_token) {
    await prisma.integration.update({
      where: { id: integrationId },
      data: { status: "EXPIRED" },
    });
    throw new Error(`Zoho refresh token expired for ${integrationId}: ${data.error}`);
  }

  const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);

  await prisma.oAuthToken.update({
    where: { integrationId },
    data: {
      accessToken: encrypt(data.access_token),
      expiresAt,
    },
  });

  return data.access_token;
}

// ---------------------------------------------------------------------------
// Get a valid access token (auto-refreshes if < 5 min to expiry)
// ---------------------------------------------------------------------------
export async function getValidAccessToken(integrationId: string): Promise<string> {
  const tokenRecord = await prisma.oAuthToken.findUnique({
    where: { integrationId },
  });

  if (!tokenRecord) throw new Error(`No OAuth token for integration ${integrationId}`);

  const expiresAt = tokenRecord.expiresAt;
  const bufferMs = 5 * 60 * 1000;
  const needsRefresh = !expiresAt || expiresAt.getTime() - Date.now() < bufferMs;

  if (needsRefresh) {
    return refreshZohoAccessToken(integrationId);
  }

  return decrypt(tokenRecord.accessToken);
}

// ---------------------------------------------------------------------------
// Store tokens after OAuth callback
// ---------------------------------------------------------------------------
export async function storeZohoTokens(params: {
  integrationId: string;
  organizationId: string;
  tokens: ZohoTokenResponse;
  dataCenter: string;
}): Promise<void> {
  const { integrationId, organizationId, tokens, dataCenter } = params;
  const dc = dataCenter.toUpperCase();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await prisma.$transaction([
    prisma.oAuthToken.upsert({
      where: { integrationId },
      create: {
        integrationId,
        organizationId,
        accessToken: encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        tokenType: tokens.token_type ?? "Bearer",
        scope: tokens.scope,
        expiresAt,
        grantedScopes: tokens.scope?.split(",") ?? [],
        metadata: { apiDomain: tokens.api_domain, dataCenter: dc },
      },
      update: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
        expiresAt,
        scope: tokens.scope,
        grantedScopes: tokens.scope?.split(",") ?? [],
        metadata: { apiDomain: tokens.api_domain, dataCenter: dc },
      },
    }),
    prisma.integration.update({
      where: { id: integrationId },
      data: { status: "ACTIVE" },
    }),
  ]);
}

// ---------------------------------------------------------------------------
// Revoke tokens
// ---------------------------------------------------------------------------
export async function revokeZohoTokens(integrationId: string): Promise<void> {
  const tokenRecord = await prisma.oAuthToken.findUnique({
    where: { integrationId },
    include: { integration: true },
  });

  if (!tokenRecord) return;

  const config = tokenRecord.integration.config as { dataCenter?: string };
  const dc = config.dataCenter?.toUpperCase() ?? "US";
  const base = DC_ACCOUNTS_URL[dc] ?? DC_ACCOUNTS_URL.US;

  try {
    const token = decrypt(tokenRecord.accessToken);
    await fetch(`${base}/oauth/v2/token/revoke?token=${encodeURIComponent(token)}`, {
      method: "POST",
    });
  } catch {
    // Ignore — token may already be expired
  }

  await prisma.$transaction([
    prisma.oAuthToken.delete({ where: { integrationId } }),
    prisma.integration.update({ where: { id: integrationId }, data: { status: "INACTIVE" } }),
  ]);
}

export function getApiBaseUrl(dataCenter: string): string {
  const dc = dataCenter.toUpperCase();
  return DC_API_URL[dc] ?? DC_API_URL.US;
}

// Re-export for external use
export { resolveRedirectUri };
