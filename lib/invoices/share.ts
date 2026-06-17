// ============================================================
// lib/invoices/share.ts
// Secure public share-link helpers — token generation and
// scrypt-based password hashing (Node crypto, no external deps).
// ============================================================

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/** URL-safe, unguessable share token. */
export function generateShareToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Hash a share-link password as `salt:derivedHex`. */
export function hashSharePassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${derived}`;
}

/** Constant-time verification. Returns true when no password is set. */
export function verifySharePassword(password: string, stored: string | null): boolean {
  if (!stored) return true;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const derived = scryptSync(password, salt, 32);
    const expected = Buffer.from(hash, "hex");
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function isShareLinkExpired(expiresAt: Date | null): boolean {
  return !!expiresAt && expiresAt.getTime() <= Date.now();
}
