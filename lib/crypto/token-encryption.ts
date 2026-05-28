// ============================================================
// FinRP — AES-256-GCM Token Encryption
// Encrypts OAuth tokens at rest. Key must be 32-byte hex string
// stored in ENCRYPTION_KEY environment variable.
//
// Output format: base64(iv || authTag || ciphertext)
//   iv       = 12 bytes  (GCM nonce)
//   authTag  = 16 bytes
//   cipher   = variable
// ============================================================

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  const buf = Buffer.from(raw, "hex");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars)");
  }
  return buf;
}

/**
 * Encrypt plaintext → base64-encoded ciphertext bundle.
 * Safe to call on the same plaintext multiple times (random IV each time).
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  // Pack: iv || tag || ciphertext → base64
  const packed = Buffer.concat([iv, tag, encrypted]);
  return packed.toString("base64");
}

/**
 * Decrypt a base64 bundle produced by encrypt().
 * Throws if the bundle is tampered with (GCM auth tag mismatch).
 */
export function decrypt(cipherBundle: string): string {
  const key = getKey();
  const packed = Buffer.from(cipherBundle, "base64");

  const iv = packed.subarray(0, IV_BYTES);
  const tag = packed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = packed.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Safely decrypt — returns null if decryption fails (key rotation, corruption).
 */
export function safeDecrypt(cipherBundle: string): string | null {
  try {
    return decrypt(cipherBundle);
  } catch {
    return null;
  }
}

/**
 * Generate a fresh random 32-byte key (for initial setup / rotation).
 */
export function generateKey(): string {
  return randomBytes(32).toString("hex");
}
