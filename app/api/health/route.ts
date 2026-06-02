// ============================================================
// GET /api/health
// Returns system health: Redis, DB connectivity, cache metrics.
// Public endpoint — no auth required (no sensitive data exposed).
// ============================================================

import { NextResponse } from "next/server";
import { redisHealthCheck } from "@/lib/redis";
import { getCacheMetrics } from "@/lib/cache";
import { prisma, getPoolMetrics } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const [redisStatus, dbStatus] = await Promise.allSettled([
    redisHealthCheck(),
    prisma.$queryRaw<[{ now: Date }]>`SELECT now()`.then(() => ({ healthy: true })),
  ]);

  const redis = redisStatus.status === "fulfilled"
    ? redisStatus.value
    : { healthy: false, error: String(redisStatus.reason) };

  const db = dbStatus.status === "fulfilled"
    ? dbStatus.value
    : { healthy: false, error: String(dbStatus.reason) };

  const cacheMetrics = getCacheMetrics();
  const poolMetrics  = getPoolMetrics();
  const allHealthy   = redis.healthy && db.healthy;

  return NextResponse.json(
    {
      status: allHealthy ? "ok" : "degraded",
      redis,
      db,
      pool:  poolMetrics,
      cache: cacheMetrics,
      timestamp: new Date().toISOString(),
    },
    { status: allHealthy ? 200 : 503 }
  );
}
