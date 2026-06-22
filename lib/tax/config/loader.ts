// ============================================================
// lib/tax/config/loader.ts
//
// resolveTaxConfig() — the single entry point every computation
// module uses to obtain rates/slabs/limits/due-dates.
//
// Resolution order (highest precedence first):
//   1. PUBLISHED, org-specific TaxConfigVersion for (scheme, period)
//   2. PUBLISHED, global   TaxConfigVersion for (scheme, period)
//   3. Code rule-pack default (registry.ts)
//
// DB overrides are deep-merged onto the default pack, so a published
// version need only contain the keys it changes. Results are cached
// per (orgId, period, axis) with a short TTL — published config rarely
// changes mid-request.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { Prisma, TaxScheme } from "@prisma/client";
import type { TaxRuleSet, TaxRuleSetOverride } from "./types";
import { getDefaultRuleSet } from "./registry";

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  value: TaxRuleSet;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(organizationId: string | null, period: string, axis: "FY" | "AY") {
  return `${organizationId ?? "global"}::${axis}::${period}`;
}

/** Deep-merge an override payload onto the base rule-set (arrays replaced). */
function deepMerge<T>(base: T, override: unknown): T {
  if (override === null || override === undefined) return base;
  if (Array.isArray(base) || Array.isArray(override) || typeof base !== "object") {
    return (override as T) ?? base;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(override as Record<string, unknown>)) {
    out[k] = deepMerge((base as Record<string, unknown>)[k], v);
  }
  return out as T;
}

export interface ResolveTaxConfigArgs {
  scheme: TaxScheme;
  /** FY "2025-26" or AY "2026-27". */
  period: string;
  axis?: "FY" | "AY";
  organizationId?: string | null;
  /** Bypass the in-process cache (used by admin previews). */
  skipCache?: boolean;
}

/**
 * Resolve the effective {@link TaxRuleSet} for a scheme + period + org.
 * Never throws — always returns at least the default code pack.
 */
export async function resolveTaxConfig(args: ResolveTaxConfigArgs): Promise<TaxRuleSet> {
  const { scheme, period, axis = "FY", organizationId = null } = args;
  const key = `${scheme}::${cacheKey(organizationId, period, axis)}`;

  if (!args.skipCache) {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;
  }

  const base = getDefaultRuleSet(period, axis);

  // Pull published overrides: org-specific first, then global. We apply
  // global first then org on top, so org wins.
  const versions = await prisma.taxConfigVersion.findMany({
    where: {
      scheme,
      period,
      status: "PUBLISHED",
      deletedAt: null,
      OR: [{ organizationId: null }, { organizationId }],
    },
    orderBy: [{ organizationId: "asc" }, { version: "desc" }],
  });

  // null org sorts first ("asc" puts null first in Postgres default), then org rows.
  let merged: TaxRuleSet = base;
  const globalVersions = versions.filter((v) => v.organizationId === null);
  const orgVersions = versions.filter((v) => v.organizationId !== null);

  if (globalVersions[0]) {
    merged = deepMerge(merged, globalVersions[0].payload as TaxRuleSetOverride);
  }
  if (organizationId && orgVersions[0]) {
    merged = deepMerge(merged, orgVersions[0].payload as TaxRuleSetOverride);
  }

  cache.set(key, { value: merged, expiresAt: Date.now() + CACHE_TTL_MS });
  return merged;
}

/** Clear the config cache (call after publishing a new version). */
export function clearTaxConfigCache(): void {
  cache.clear();
}

/**
 * Publish a config version: archives any currently-published version for
 * the same (org, scheme, period) and marks this one PUBLISHED. Returns the
 * published row. Caller is responsible for RBAC + audit logging.
 */
export async function publishTaxConfigVersion(versionId: string, publishedById: string) {
  const version = await prisma.taxConfigVersion.findUnique({ where: { id: versionId } });
  if (!version) throw new Error("Config version not found");

  const result = await prisma.$transaction(async (tx) => {
    await tx.taxConfigVersion.updateMany({
      where: {
        organizationId: version.organizationId,
        scheme: version.scheme,
        period: version.period,
        status: "PUBLISHED",
        id: { not: versionId },
      },
      data: { status: "ARCHIVED" },
    });
    return tx.taxConfigVersion.update({
      where: { id: versionId },
      data: { status: "PUBLISHED", publishedAt: new Date(), publishedById },
    });
  });

  clearTaxConfigCache();
  return result;
}

export type { TaxRuleSet };
export type TaxConfigPayload = Prisma.InputJsonValue;
