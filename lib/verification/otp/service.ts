// ============================================================
// lib/verification/otp/service.ts
//
// Phone/Email verification via a real one-time-passcode sent through
// the already-configured Twilio WhatsApp / Resend email senders
// (lib/notifications/whatsapp.ts, lib/notifications/email.ts) — no
// new vendor needed. The code itself is never persisted in plaintext:
// only a salted SHA-256 hash + expiry + attempt count, mirroring the
// project's Aadhaar-hash-never-plaintext convention.
// ============================================================

import { randomBytes, createHash, timingSafeEqual } from "crypto";
import { sendWhatsApp } from "@/lib/notifications/whatsapp";
import { sendEmail } from "@/lib/notifications/email";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

export interface OtpChallenge {
  codeHash: string;
  salt: string;
  expiresAt: string; // ISO
  attempts: number;
  destination: string; // last 4 digits / masked, for display only
}

function generateCode(): string {
  const n = randomBytes(4).readUInt32BE(0) % 1000000;
  return String(n).padStart(6, "0");
}

function hashCode(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

function mask(destination: string): string {
  if (destination.includes("@")) {
    const [user, domain] = destination.split("@");
    return `${user.slice(0, 2)}***@${domain}`;
  }
  return `***${destination.slice(-4)}`;
}

export function issueChallenge(destination: string): { code: string; challenge: OtpChallenge } {
  const code = generateCode();
  const salt = randomBytes(16).toString("hex");
  return {
    code,
    challenge: {
      codeHash: hashCode(code, salt),
      salt,
      expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      attempts: 0,
      destination: mask(destination),
    },
  };
}

export type OtpConfirmResult = "VERIFIED" | "EXPIRED" | "EXHAUSTED" | "INCORRECT";

export function confirmChallenge(challenge: OtpChallenge, submittedCode: string): OtpConfirmResult {
  if (new Date(challenge.expiresAt).getTime() < Date.now()) return "EXPIRED";
  if (challenge.attempts >= MAX_ATTEMPTS) return "EXHAUSTED";

  const submittedHash = Buffer.from(hashCode(submittedCode, challenge.salt), "hex");
  const expectedHash = Buffer.from(challenge.codeHash, "hex");
  const match = submittedHash.length === expectedHash.length && timingSafeEqual(submittedHash, expectedHash);
  return match ? "VERIFIED" : "INCORRECT";
}

export async function dispatchPhoneOtp(phone: string, code: string): Promise<{ success: boolean; error?: string }> {
  return sendWhatsApp({ to: phone, body: `Your FinRP verification code is ${code}. It expires in 10 minutes. Do not share this code with anyone.` });
}

export async function dispatchEmailOtp(email: string, code: string): Promise<{ success: boolean; error?: string }> {
  const result = await sendEmail({
    to: email,
    subject: "Your FinRP verification code",
    html: `<p>Your verification code is <strong style="font-size:20px;letter-spacing:2px;">${code}</strong>.</p><p>It expires in 10 minutes. Do not share this code with anyone.</p>`,
  });
  return { success: result.success, error: result.error };
}
