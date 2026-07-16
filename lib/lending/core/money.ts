// ============================================================
// lib/lending/core/money.ts
//
// Decimal money helpers built on Prisma.Decimal (decimal.js under the
// hood) — same contract as lib/tax/core/money.ts. Loan principal,
// interest, EMI and fee figures must never use binary floating point;
// every rupee figure flows through these helpers and is rounded
// half-up to 2 decimals (paise) for storage / payloads.
// ============================================================

import { Prisma } from "@prisma/client";

const { Decimal } = Prisma;
export type Money = Prisma.Decimal;
export type MoneyInput = Prisma.Decimal.Value | null | undefined;

/** Construct a Decimal, treating null/undefined/"" as 0. */
export function D(v: MoneyInput = 0): Money {
  if (v === null || v === undefined || v === "") return new Decimal(0);
  return new Decimal(v);
}

/** Sum a list of money-ish values. */
export function sum(values: MoneyInput[]): Money {
  return values.reduce<Money>((acc, v) => acc.plus(D(v)), new Decimal(0));
}

/** a + b */
export function add(a: MoneyInput, b: MoneyInput): Money {
  return D(a).plus(D(b));
}

/** a - b */
export function sub(a: MoneyInput, b: MoneyInput): Money {
  return D(a).minus(D(b));
}

/** value × rate% (e.g. pct(100000, 2.5) = 2500). */
export function pct(value: MoneyInput, ratePct: MoneyInput): Money {
  return round2(D(value).times(D(ratePct)).dividedBy(100));
}

/** Round half-up to 2 decimals (paise). */
export function round2(v: MoneyInput): Money {
  return D(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Round half-up to whole rupees. */
export function roundRupee(v: MoneyInput): Money {
  return D(v).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

/** Convert to a JS number — for charts / non-monetary display only. */
export function toNumber(v: MoneyInput): number {
  return D(v).toNumber();
}

/** Stable 2-decimal string for payloads ("1234.50"). */
export function toFixed2(v: MoneyInput): string {
  return round2(v).toFixed(2);
}

/** True when the value is (within rounding) zero. */
export function isZero(v: MoneyInput): boolean {
  return round2(v).isZero();
}

/** |a - b| — absolute difference, rounded. */
export function absDiff(a: MoneyInput, b: MoneyInput): Money {
  return round2(D(a).minus(D(b)).abs());
}

/** True when a and b are equal within `tolerance` rupees (default ₹1). */
export function approxEqual(a: MoneyInput, b: MoneyInput, tolerance = 1): boolean {
  return absDiff(a, b).lessThanOrEqualTo(tolerance);
}

/** Clamp v into [min, max]. */
export function clamp(v: MoneyInput, min: MoneyInput, max: MoneyInput): Money {
  const val = D(v);
  const lo = D(min);
  const hi = D(max);
  if (val.lessThan(lo)) return lo;
  if (val.greaterThan(hi)) return hi;
  return val;
}
