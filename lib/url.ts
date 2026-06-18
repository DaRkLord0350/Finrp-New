// ============================================================
// lib/url.ts
// Single source of truth for the app's public base URL.
//
// Email links (invites, invoices, share pages) MUST be absolute
// and MUST point at the deployed app — never localhost in prod.
// Next.js loads .env.local (localhost in dev) over .env, and the
// hosting platform injects the real value in production, so we
// read NEXT_PUBLIC_APP_URL first and fall back to the prod domain
// (never localhost) when unset.
// ============================================================

const PROD_FALLBACK = "https://www.finrp.org";

/**
 * Returns the app base URL with no trailing slash, e.g.
 * "https://www.finrp.org" or "http://localhost:3000" (dev only).
 */
export function getAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    PROD_FALLBACK;
  return raw.replace(/\/+$/, "");
}

/** Build an absolute app URL from a path ("/foo" or "foo"). */
export function appUrl(path: string): string {
  const base = getAppBaseUrl();
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
