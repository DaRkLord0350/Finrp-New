// ============================================================
// lib/tax/config/registry.ts
//
// Maps a Financial Year / Assessment Year to its default code
// rule-pack. New years are added by dropping a pack file in
// ./packs and registering it here — no logic changes required.
// ============================================================

import type { TaxRuleSet } from "./types";
import { FY_2025_26 } from "./packs/fy-2025-26";

/** FY → default rule pack. */
const FY_PACKS: Record<string, TaxRuleSet> = {
  "2025-26": FY_2025_26,
};

/** Convert a Financial Year ("2025-26") to its Assessment Year ("2026-27"). */
export function fyToAy(fy: string): string {
  const [start, end] = fy.split("-");
  const startYear = parseInt(start, 10);
  const endYear = parseInt(end.length === 2 ? `${start.slice(0, 2)}${end}` : end, 10);
  return `${startYear + 1}-${String(endYear + 1).slice(-2)}`;
}

/** Convert an Assessment Year ("2026-27") to its Financial Year ("2025-26"). */
export function ayToFy(ay: string): string {
  const [start, end] = ay.split("-");
  const startYear = parseInt(start, 10);
  const endYear = parseInt(end.length === 2 ? `${start.slice(0, 2)}${end}` : end, 10);
  return `${startYear - 1}-${String(endYear - 1).slice(-2)}`;
}

/** The list of FY periods that ship with a default rule-pack. */
export function supportedFinancialYears(): string[] {
  return Object.keys(FY_PACKS).sort();
}

/** The newest FY we have a pack for — used as a safe fallback. */
export function latestFinancialYear(): string {
  return supportedFinancialYears().slice(-1)[0];
}

/**
 * Resolve the DEFAULT (code) rule-pack for a period expressed as either
 * a Financial Year ("2025-26") or an Assessment Year ("2026-27").
 * Falls back to the latest known FY pack when the exact year is missing
 * (so the engine degrades gracefully rather than throwing).
 */
export function getDefaultRuleSet(period: string, axis: "FY" | "AY" = "FY"): TaxRuleSet {
  const fy = axis === "AY" ? ayToFy(period) : period;
  return FY_PACKS[fy] ?? FY_PACKS[latestFinancialYear()];
}

/** True when we ship a hand-authored pack for this FY (vs falling back). */
export function hasExactPack(period: string, axis: "FY" | "AY" = "FY"): boolean {
  const fy = axis === "AY" ? ayToFy(period) : period;
  return Boolean(FY_PACKS[fy]);
}
