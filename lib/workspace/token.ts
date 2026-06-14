// ============================================================
// lib/workspace/token.ts
//
// HMAC-SHA256 signed workspace session token.
//
// Format:  base64url(JSON payload) + "." + base64url(signature)
//
// Runtime-agnostic by design: uses only Web Crypto + TextEncoder
// so the SAME verify function runs in the Edge middleware (to
// drop forged/expired cookies early) and in the Node runtime
// (lib/workspace/context.ts).
//
// The token binds the workspace to a specific Clerk user (cid)
// AND DB user (uid) — a stolen cookie is useless under another
// login, and a role change invalidates it server-side.
// ============================================================

export const WORKSPACE_COOKIE = "finrp_ws";

/** Workspace sessions auto-expire after 8 hours. */
export const WORKSPACE_TTL_SECONDS = 8 * 60 * 60;

export interface WorkspaceTokenPayload {
  /** schema version */
  v: 1;
  /** client organizationId being impersonated */
  orgId: string;
  /** DB user id of the acting CA */
  uid: string;
  /** Clerk user id of the acting CA */
  cid: string;
  /** issued-at (unix seconds) */
  iat: number;
  /** expiry (unix seconds) */
  exp: number;
}

function getSecret(): string {
  const secret =
    process.env.WORKSPACE_SESSION_SECRET || process.env.CLERK_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "[workspace] WORKSPACE_SESSION_SECRET (or CLERK_SECRET_KEY) must be set"
    );
  }
  return secret;
}

// ---------------------------------------------------------------------------
// base64url helpers — no Buffer so they work in the Edge runtime
// ---------------------------------------------------------------------------
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// ---------------------------------------------------------------------------
// sign / verify
// ---------------------------------------------------------------------------
export async function createWorkspaceToken(input: {
  orgId: string;
  uid: string;
  cid: string;
  ttlSeconds?: number;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: WorkspaceTokenPayload = {
    v: 1,
    orgId: input.orgId,
    uid: input.uid,
    cid: input.cid,
    iat: now,
    exp: now + (input.ttlSeconds ?? WORKSPACE_TTL_SECONDS),
  };

  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${bytesToBase64Url(new Uint8Array(sig))}`;
}

/**
 * Verifies signature + expiry. Returns the payload or null —
 * never throws on malformed input (cookies are attacker-controlled).
 */
export async function verifyWorkspaceToken(
  token: string | undefined | null
): Promise<WorkspaceTokenPayload | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;

  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  try {
    const key = await hmacKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(sig) as unknown as ArrayBuffer,
      new TextEncoder().encode(body)
    );
    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(body))
    ) as WorkspaceTokenPayload;

    if (payload.v !== 1) return null;
    if (!payload.orgId || !payload.uid || !payload.cid) return null;
    if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
