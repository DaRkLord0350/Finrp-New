// ============================================================
// Unit tests — money math + PII helpers
// ============================================================

import { describe, it, expect } from "vitest";
import { D, sum, add, sub, pct, round2, toFixed2, approxEqual, absDiff, isZero } from "@/lib/tax/core/money";
import { makeValidGstin, gstinCheckDigit, isValidPan, maskPan, isValidTan, encryptPan, decryptPii } from "@/lib/tax/core/pii";
import { ValidationEngine } from "@/lib/validation/engine";

// Encryption needs a 32-byte hex key.
process.env.ENCRYPTION_KEY ??= "0".repeat(64);

describe("money helpers", () => {
  it("rounds half-up to paise", () => {
    expect(round2(1234.005).toFixed(2)).toBe("1234.01");
    expect(toFixed2(0.1 + 0.2)).toBe("0.30"); // no binary float drift
  });

  it("adds / subtracts / sums precisely", () => {
    expect(add(0.1, 0.2).toFixed(2)).toBe("0.30");
    expect(sub(100, 0.01).toFixed(2)).toBe("99.99");
    expect(sum([10, 20, 30.5]).toFixed(2)).toBe("60.50");
  });

  it("computes a percentage as tax", () => {
    expect(pct(1000, 18).toNumber()).toBe(180);
    expect(pct(50000, 9).toNumber()).toBe(4500);
  });

  it("compares with tolerance", () => {
    expect(approxEqual(100, 100.5, 1)).toBe(true);
    expect(approxEqual(100, 102, 1)).toBe(false);
    expect(absDiff(100, 97).toNumber()).toBe(3);
    expect(isZero(D(0))).toBe(true);
  });
});

describe("GSTIN / PII", () => {
  it("generates checksum-valid GSTINs accepted by the validator", () => {
    const gstin = makeValidGstin("27AAPFU0939F1Z");
    expect(gstin).toHaveLength(15);
    expect(new ValidationEngine().validateGstin(gstin).valid).toBe(true);
  });

  it("check digit is deterministic", () => {
    expect(gstinCheckDigit("27AAPFU0939F1Z")).toBe(makeValidGstin("27AAPFU0939F1Z")[14]);
  });

  it("validates + masks PAN/TAN", () => {
    expect(isValidPan("ABCDE1234F")).toBe(true);
    expect(isValidPan("ABC1234")).toBe(false);
    expect(maskPan("ABCDE1234F")).toBe("ABCDE****F");
    expect(isValidTan("ABCD12345E")).toBe(true);
  });

  it("round-trips PAN encryption", () => {
    const cipher = encryptPan("ABCDE1234F");
    expect(cipher).not.toContain("ABCDE1234F");
    expect(decryptPii(cipher)).toBe("ABCDE1234F");
  });
});
