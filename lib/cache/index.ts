// ============================================================
// FinRP — Centralized Cache Module
//
// All Redis cache helpers live here. Import these everywhere
// instead of calling redisGet/Set directly.
//
// Architecture:
//   • withCache()       — cache-aside: read → miss → compute → write
//   • cacheGet/Set/Del  — typed helpers with silent error handling
//   • CacheKey          — namespaced key builders
//   • TTL               — centralized TTL constants
//   • cacheMetrics      — hit/miss counters (in-process, reset on restart)
// ============================================================

import { redisGet, redisSet, redisDel, getCacheClient } from "@/lib/redis";

// ---------------------------------------------------------------------------
// TTL constants (seconds)
// ---------------------------------------------------------------------------
export const TTL = {
  USER_SESSION: 300,    // 5 min — user profile + org
  TENANT_ID:    300,    // 5 min — clerkId → organizationId mapping
  DASHBOARD:    60,     // 1 min — live-ish metrics
  FIRM_STATS:   300,    // 5 min — firm-level stats
  ANALYTICS:    900,    // 15 min — precomputed snapshots
  ORG_SETTINGS: 3600,   // 1 hour — org settings (rarely change)
  NOTIFICATIONS: 30,    // 30 sec — unread counts
  ROLE_PERMS:   1800,   // 30 min — resolved per-org role permission set
} as const;

// ---------------------------------------------------------------------------
// Cache key builders — namespace every key under "finrp:"
// ---------------------------------------------------------------------------
export const CacheKey = {
  user:        (clerkId: string)             => `finrp:user:${clerkId}`,
  tenant:      (clerkId: string)             => `finrp:tenant:${clerkId}`,
  dashboard:   (orgId: string)               => `finrp:dashboard:${orgId}`,
  firmStats:   (firmId: string)              => `finrp:firm:${firmId}:stats`,
  analytics:   (orgId: string, p: string)    => `finrp:analytics:${orgId}:${p}`,
  orgSettings: (orgId: string)               => `finrp:org:${orgId}:settings`,
  notifCount:  (userId: string)              => `finrp:notif:${userId}:unread`,
  rolePerms:   (orgId: string, role: string) => `finrp:perms:${orgId}:${role}`,
  rolePermsPattern: (orgId: string)          => `finrp:perms:${orgId}:*`,
} as const;

// ---------------------------------------------------------------------------
// In-process cache metrics (per-instance counters)
// ---------------------------------------------------------------------------
const metrics = {
  hits:   0,
  misses: 0,
  errors: 0,
  writes: 0,
};

export function getCacheMetrics() {
  const total    = metrics.hits + metrics.misses;
  const hitRate  = total > 0 ? Math.round((metrics.hits / total) * 1000) / 10 : 0;
  return { ...metrics, total, hitRatePercent: hitRate };
}

export function resetCacheMetrics() {
  metrics.hits   = 0;
  metrics.misses = 0;
  metrics.errors = 0;
  metrics.writes = 0;
}

// ---------------------------------------------------------------------------
// Typed get / set / del helpers
// Errors are caught here so a Redis outage never surfaces as a 500.
// ---------------------------------------------------------------------------
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redisGet(key);
    if (raw === null) {
      metrics.misses++;
      return null;
    }
    metrics.hits++;
    return JSON.parse(raw) as T;
  } catch {
    metrics.errors++;
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttl: number): Promise<void> {
  try {
    await redisSet(key, JSON.stringify(value), ttl);
    metrics.writes++;
  } catch (err) {
    metrics.errors++;
    console.error(`[cache] set error ${key}:`, (err as Error).message);
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    await Promise.all(keys.map((k) => redisDel(k)));
  } catch (err) {
    metrics.errors++;
    console.error("[cache] del error:", (err as Error).message);
  }
}

// Pattern-based deletion — use sparingly; KEYS is O(n) in Redis.
// Only safe on small keyspaces or during low-traffic maintenance windows.
export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    const conn = getCacheClient();
    const keys = await conn.keys(pattern);
    if (keys.length > 0) await conn.del(...keys);
  } catch (err) {
    metrics.errors++;
    console.error(`[cache] delPattern error ${pattern}:`, (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Singleflight deduplication map.
// Prevents cache stampedes: when N concurrent requests all miss the same
// key they share one in-flight compute() call instead of each launching
// their own, which would send N×(query count) DB operations simultaneously.
// ---------------------------------------------------------------------------
const _inFlight = new Map<string, Promise<unknown>>();

// ---------------------------------------------------------------------------
// withCache — cache-aside helper with singleflight deduplication
//
// Flow:
//   1. Cache hit  → return immediately (fast path, no DB)
//   2. In-flight  → await the already-running compute (singleflight)
//   3. Cache miss → compute(), write to cache, return value
//
// Usage:
//   const data = await withCache(CacheKey.dashboard(orgId), TTL.DASHBOARD, () => computeDashboard(orgId));
// ---------------------------------------------------------------------------
export async function withCache<T>(
  key: string,
  ttl: number,
  compute: () => Promise<T>
): Promise<T> {
  // ── Fast path: cache hit ──────────────────────────────────────────────────
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  // ── Singleflight: reuse in-flight compute for this key ───────────────────
  const existing = _inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  // ── Cache miss: start compute, register in-flight ─────────────────────────
  const promise = (async () => {
    try {
      const value = await compute();
      // Fire-and-forget write; cacheSet already logs errors
      cacheSet(key, value, ttl).catch(() => {});
      return value;
    } finally {
      _inFlight.delete(key);
    }
  })();

  _inFlight.set(key, promise);
  return promise;
}
