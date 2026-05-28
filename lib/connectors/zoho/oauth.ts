// ============================================================
// FinRP — Zoho OAuth 2.0
// Handles full OAuth lifecycle: initiate, callback, refresh.
// Tokens stored encrypted in oauth_tokens table.
// Supports all Zoho data centers: IN, US, EU, AU, JP, CN.
// ============================================================

import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto/token-encryption";

// ---------------------------------------------------------------------------
// Zoho data-center base URLs
// ---------------------------------------------------------------------------
const DC_ACCOUNTS_URL: Record<string, string> = {
  IN: "https://accounts.zoho.in",
  US: "https://accounts.zoho.com",
  EU: "https://accounts.zoho.eu",
  AU: "https://accounts.zoho.com.au",
  JP: "https://accounts.zoho.jp",
  CN: "https://accounts.zoho.com.cn",
};

const DC_API_URL: Record<string, string> = {
  IN: "https://www.zohoapis.in",
  US: "https://www.zohoapis.com",
  EU: "https://www.zohoapis.eu",
  AU: "https://www.zohoapis.com.au",
  JP: "https://www.zohoapis.jp",
  CN: "https://www.zohoapis.com.cn",
};

// CRM + Books scopes
export const ZOHO_SCOPES = [
  "ZohoCRM.modules.ALL",
  "ZohoCRM.settings.ALL",
  "ZohoBooks.fullaccess.ALL",
  "ZohoInventory.fullaccess.ALL",
].join(",");

// ---------------------------------------------------------------------------
// State management — encode/decode OAuth state parameter
// ---------------------------------------------------------------------------
interface OAuthState {
  organizationId: string;
  integrationId: string;
  dataCenter: string;
  nonce: string;           // CSRF protection
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
}): string {
  const { organizationId, integrationId, dataCenter, clientId, redirectUri } = params;
  const dc = dataCenter.toUpperCase();
  const base = DC_ACCOUNTS_URL[dc] ?? DC_ACCOUNTS_URL.US;

  const state = encodeState({
    organizationId,
    integrationId,
    dataCenter: dc,
    nonce: Math.random().toString(36).slice(2),
  });

  const url = new URL(`${base}/oauth/v2/auth`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", ZOHO_SCOPES);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "consent");

  return url.toString();
}

// ---------------------------------------------------------------------------
// Exchange authorization code for tokens
// ---------------------------------------------------------------------------
export interface ZohoTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;     // seconds
  scope: string;
  api_domain: string;
}

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

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(`${base}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zoho token exchange failed (${res.status}): ${err}`);
  }

  const data = await res.json() as ZohoTokenResponse & { error?: string };
  if (data.error) {
    throw new Error(`Zoho token exchange error: ${data.error}`);
  }

  return data;
}

// ---------------------------------------------------------------------------
// Refresh access token using stored refresh token
// ---------------------------------------------------------------------------
export async function refreshZohoAccessToken(integrationId: string): Promise<string> {
  const tokenRecord = await prisma.oAuthToken.findUnique({
    where: { integrationId },
    include: { integration: true },
  });

  if (!tokenRecord) throw new Error(`No OAuth token found for integration ${integrationId}`);
  if (!tokenRecord.refreshToken) throw new Error("No refresh token available");

  const config = tokenRecord.integration.config as {
    dataCenter: string;
    clientId: string;
    clientSecret: string;
  };

  const dc = config.dataCenter?.toUpperCase() ?? "US";
  const base = DC_ACCOUNTS_URL[dc] ?? DC_ACCOUNTS_URL.US;

  const refreshToken = decrypt(tokenRecord.refreshToken);

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
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
    // Refresh token also expired — mark integration as EXPIRED
    await prisma.integration.update({
      where: { id: integrationId },
      data: { status: "EXPIRED" },
    });
    throw new Error(`Zoho refresh token expired: ${data.error}`);
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
  const bufferMs = 5 * 60 * 1000; // refresh 5 min before expiry
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

  const config = tokenRecord.integration.config as { dataCenter?: string; clientId?: string };
  const dc = config.dataCenter?.toUpperCase() ?? "US";
  const base = DC_ACCOUNTS_URL[dc] ?? DC_ACCOUNTS_URL.US;

  // Best-effort revoke at Zoho
  try {
    const token = decrypt(tokenRecord.accessToken);
    await fetch(`${base}/oauth/v2/token/revoke?token=${encodeURIComponent(token)}`, {
      method: "POST",
    });
  } catch {
    // Ignore revoke errors (token may already be expired)
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
