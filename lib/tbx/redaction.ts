// ============================================================
// FinRP — TBX Payload Redaction
//
// Strips/masks sensitive fields from TBX request/response payloads
// before they are persisted to TbxApiLog. Applied unconditionally
// by lib/tbx/logging.ts on every provider call — never optional,
// never deferred (full Aadhaar numbers, OTPs, and full bank account
// numbers must never land in the database, see docs/TBX_FOUNDATION
// .md §13 Risk 9).
//
// Recurses through arbitrary JSON — provider payload shapes are not
// fully known ahead of real TBX API docs, so this walks the whole
// structure rather than a fixed allow-list of paths.
// ============================================================

const FULL_REDACT_KEYS = /aadhaar|otp|password|secret|token|authorization|cvv|pin\b/i;
const MASK_LAST4_KEYS = /accountnumber|account_number/i;

const REDACTED = "[redacted]";

function maskLast4(value: string): string {
  if (value.length <= 4) return REDACTED;
  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

function redactValue(key: string, value: unknown): unknown {
  if (FULL_REDACT_KEYS.test(key)) return REDACTED;
  if (MASK_LAST4_KEYS.test(key) && typeof value === "string") return maskLast4(value);
  return redact(value);
}

/** Deep-redact an arbitrary JSON value (object, array, or scalar). */
export function redact<T>(value: T): T {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => redact(item)) as unknown as T;
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = redactValue(key, val);
    }
    return out as unknown as T;
  }

  return value;
}
