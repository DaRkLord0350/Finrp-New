// ============================================================
// lib/tax/core/pii.ts
//
// Encryption + masking for sensitive tax identifiers (PAN, TAN,
// Aadhaar). Wraps the existing AES-256-GCM helper so the engine never
// stores these in plaintext. Encrypted columns carry an `Enc` suffix.
// ============================================================

import { encrypt, decrypt, safeDecrypt } from "@/lib/crypto/token-encryption";

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const TAN_RE = /^[A-Z]{4}[0-9]{5}[A-Z]$/;
export const AADHAAR_RE = /^[0-9]{12}$/;

const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Compute the GSTIN check digit (mod-36) for the first 14 characters. */
export function gstinCheckDigit(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const ci = GSTIN_CHARS.indexOf(first14[i].toUpperCase());
    if (ci === -1) throw new Error(`Invalid GSTIN character at position ${i}`);
    const product = ci * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36];
}

/** Append a valid check digit to a 14-char GSTIN base (used for seeding/tests). */
export function makeValidGstin(first14: string): string {
  const base = first14.toUpperCase();
  return base + gstinCheckDigit(base);
}

export function isValidPan(pan: string): boolean {
  return PAN_RE.test(pan.toUpperCase().trim());
}

export function isValidTan(tan: string): boolean {
  return TAN_RE.test(tan.toUpperCase().trim());
}

export function isValidAadhaar(aadhaar: string): boolean {
  return AADHAAR_RE.test(aadhaar.replace(/\s/g, ""));
}

/** Encrypt a PAN (validates format first). Returns the cipher bundle. */
export function encryptPan(pan: string): string {
  const norm = pan.toUpperCase().trim();
  if (!isValidPan(norm)) throw new Error(`Invalid PAN format: ${maskPan(norm)}`);
  return encrypt(norm);
}

/** Encrypt a TAN (validates format first). */
export function encryptTan(tan: string): string {
  const norm = tan.toUpperCase().trim();
  if (!isValidTan(norm)) throw new Error("Invalid TAN format");
  return encrypt(norm);
}

/** Encrypt an Aadhaar number (12 digits, spaces stripped). */
export function encryptAadhaar(aadhaar: string): string {
  const norm = aadhaar.replace(/\s/g, "");
  if (!isValidAadhaar(norm)) throw new Error("Invalid Aadhaar format");
  return encrypt(norm);
}

/** Decrypt a stored cipher bundle (throws on tamper). */
export function decryptPii(cipher: string): string {
  return decrypt(cipher);
}

/** Decrypt, returning null instead of throwing on failure. */
export function safeDecryptPii(cipher: string | null | undefined): string | null {
  if (!cipher) return null;
  return safeDecrypt(cipher);
}

/** Mask a PAN for display: "ABCDE1234F" → "ABCDE****F". */
export function maskPan(pan: string): string {
  const p = pan.toUpperCase().trim();
  if (p.length !== 10) return "****";
  return `${p.slice(0, 5)}****${p.slice(-1)}`;
}

/** Mask a TAN: "ABCD12345E" → "ABCD****E". */
export function maskTan(tan: string): string {
  const t = tan.toUpperCase().trim();
  if (t.length !== 10) return "****";
  return `${t.slice(0, 4)}****${t.slice(-1)}`;
}

/** Mask an Aadhaar: show last 4 only. */
export function maskAadhaar(aadhaar: string): string {
  const a = aadhaar.replace(/\s/g, "");
  if (a.length !== 12) return "XXXX-XXXX-XXXX";
  return `XXXX-XXXX-${a.slice(-4)}`;
}

/** Decrypt a stored PAN and return its masked form (for UI lists). */
export function maskedPanFromCipher(cipher: string | null | undefined): string | null {
  const pan = safeDecryptPii(cipher);
  return pan ? maskPan(pan) : null;
}
