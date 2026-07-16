// ============================================================
// lib/verification/ifsc/service.ts
//
// Real HTTP call to Razorpay's public IFSC lookup API. No API key,
// no account — genuinely free and unauthenticated, so this is
// implemented for real rather than provider-pattern-stubbed.
// ============================================================

import { IfscFormatError, IfscLookupError, IfscNotFoundError, type IfscLookupResult } from "./types";

const IFSC_BASE_URL = process.env.IFSC_LOOKUP_BASE_URL ?? "https://ifsc.razorpay.com";
const TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

function normalizeIfsc(code: string): string {
  return code.trim().toUpperCase();
}

export function isValidIfscFormat(code: string): boolean {
  return IFSC_PATTERN.test(normalizeIfsc(code));
}

interface RazorpayIfscResponse {
  BANK: string;
  BANKCODE: string;
  BRANCH: string;
  ADDRESS: string;
  CITY: string;
  DISTRICT: string;
  STATE: string;
  CONTACT: string | null;
  MICR: string | null;
  UPI: boolean;
  RTGS: boolean;
  NEFT: boolean;
  IMPS: boolean;
  IFSC: string;
}

async function fetchOnce(code: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${IFSC_BASE_URL}/${code}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Looks up a bank branch by IFSC code. Throws IfscFormatError / IfscNotFoundError / IfscLookupError. */
export async function lookupIfsc(rawCode: string): Promise<IfscLookupResult> {
  const code = normalizeIfsc(rawCode);
  if (!isValidIfscFormat(code)) throw new IfscFormatError(code);

  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchOnce(code);

      if (res.status === 404) throw new IfscNotFoundError(code);
      if (!res.ok) throw new IfscLookupError(`IFSC lookup responded with HTTP ${res.status}`);

      const json = (await res.json()) as RazorpayIfscResponse;
      return {
        ifsc: json.IFSC,
        bankName: json.BANK,
        bankCode: json.BANKCODE,
        branch: json.BRANCH,
        address: json.ADDRESS,
        city: json.CITY,
        district: json.DISTRICT,
        state: json.STATE,
        contact: json.CONTACT ?? null,
        micr: json.MICR ?? null,
        upi: Boolean(json.UPI),
        rtgs: Boolean(json.RTGS),
        neft: Boolean(json.NEFT),
        imps: Boolean(json.IMPS),
      };
    } catch (err) {
      if (err instanceof IfscNotFoundError || err instanceof IfscFormatError) throw err;
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
      }
    }
  }

  const message = lastErr instanceof Error ? lastErr.message : "Unknown error";
  throw new IfscLookupError(`IFSC lookup failed after ${MAX_RETRIES + 1} attempts: ${message}`);
}
