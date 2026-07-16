import { describe, it, expect } from "vitest";
import { D, add, sub, pct, round2, roundRupee, toNumber, toFixed2, isZero, absDiff, approxEqual, clamp, sum } from "@/lib/lending/core/money";

describe("D (Decimal constructor)", () => {
  it("treats null/undefined/empty string as zero", () => {
    expect(toNumber(D(null))).toBe(0);
    expect(toNumber(D(undefined))).toBe(0);
    expect(toNumber(D(""))).toBe(0);
  });
  it("parses strings and numbers", () => {
    expect(toNumber(D("123.45"))).toBe(123.45);
    expect(toNumber(D(100))).toBe(100);
  });
});

describe("arithmetic helpers", () => {
  it("add/sub/sum are exact for money-shaped decimals", () => {
    expect(toNumber(add(0.1, 0.2))).toBe(0.3); // classic float trap — Decimal must not reproduce it
    expect(toNumber(sub(10, 3.5))).toBe(6.5);
    expect(toNumber(sum([1.1, 2.2, 3.3]))).toBeCloseTo(6.6, 5);
  });

  it("pct computes value * rate / 100, rounded to paise", () => {
    expect(toNumber(pct(100_000, 2.5))).toBe(2500);
    expect(toNumber(pct(1000, 33.333))).toBeCloseTo(333.33, 2);
  });
});

describe("rounding", () => {
  it("round2 rounds half-up to 2 decimals", () => {
    expect(toFixed2(round2(1.005))).toBe("1.01");
    expect(toFixed2(round2(1.004))).toBe("1.00");
  });
  it("roundRupee rounds half-up to whole rupees", () => {
    expect(toNumber(roundRupee(100.5))).toBe(101);
    expect(toNumber(roundRupee(100.49))).toBe(100);
  });
});

describe("comparisons", () => {
  it("isZero treats sub-paise noise as zero after rounding", () => {
    expect(isZero(0)).toBe(true);
    expect(isZero(0.001)).toBe(true);
    expect(isZero(0.01)).toBe(false);
  });
  it("absDiff and approxEqual support reconciliation-style tolerance checks", () => {
    expect(toNumber(absDiff(100, 99.5))).toBe(0.5);
    expect(approxEqual(100, 100.5, 1)).toBe(true);
    expect(approxEqual(100, 102, 1)).toBe(false);
  });
});

describe("clamp", () => {
  it("clamps into [min, max]", () => {
    expect(toNumber(clamp(50, 0, 100))).toBe(50);
    expect(toNumber(clamp(-10, 0, 100))).toBe(0);
    expect(toNumber(clamp(150, 0, 100))).toBe(100);
  });
});
