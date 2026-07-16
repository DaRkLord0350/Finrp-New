// ============================================================
// lib/api/rate-limit.ts
//
// Minimal fixed-window rate limiter on the existing Redis cache client
// (lib/redis.ts's getCacheClient()) — no new infrastructure dependency.
// First consumer: Lending's provider-calling routes (credit-bureau-style
// pulls are per-call-cost and abuse-prone), reusable by any future
// Phase 3 module with the same concern.
//
// Fails OPEN: if Redis is unreachable, the request is allowed rather
// than blocked — a rate limiter must never become a hard dependency
// for the routes it protects.
// ============================================================

import { getCacheClient } from "@/lib/redis";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // epoch seconds
}

/**
 * `key` should already be scoped to the caller (e.g. `lending:disburse:${organizationId}`).
 * `limit` requests per `windowSeconds`.
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const windowKey = `finrp:ratelimit:${key}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;
  const resetAt = (Math.floor(Date.now() / 1000 / windowSeconds) + 1) * windowSeconds;

  try {
    const client = getCacheClient();
    const count = await client.incr(windowKey);
    if (count === 1) await client.expire(windowKey, windowSeconds);
    return { allowed: count <= limit, limit, remaining: Math.max(0, limit - count), resetAt };
  } catch {
    // Redis unavailable — fail open.
    return { allowed: true, limit, remaining: limit, resetAt };
  }
}
