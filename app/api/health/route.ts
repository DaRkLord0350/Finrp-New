// ============================================================
// GET /api/health
// Returns system health: Redis, DB connectivity, cache metrics.
// Public endpoint — no auth required (no sensitive data exposed).
// ============================================================

import { NextResponse } from "next/server";
import { redisHealthCheck } from "@/lib/redis";
import { getCacheMetrics } from "@/lib/cache";
import { prisma, getPoolMetrics } from "@/lib/prisma";
import { getQueueHealth } from "@/lib/jobs/queues";
import { getDlqHealth } from "@/lib/jobs/queues/dlq";

export const dynamic = "force-dynamic";

export async function GET() {
  const [redisStatus, dbStatus, queueStatus, dlqStatus] = await Promise.allSettled([
    redisHealthCheck(),
    prisma.$queryRaw<[{ now: Date }]>`SELECT now()`.then(() => ({ healthy: true })),
    getQueueHealth(),
    getDlqHealth(),
  ]);

  const redis = redisStatus.status === "fulfilled"
    ? redisStatus.value
    : { healthy: false, error: String(redisStatus.reason) };

  const db = dbStatus.status === "fulfilled"
    ? dbStatus.value
    : { healthy: false, error: String(dbStatus.reason) };

  const cacheMetrics = getCacheMetrics();
  const poolMetrics  = getPoolMetrics();
  const queues = queueStatus.status === "fulfilled" ? queueStatus.value : null;
  const dlq = dlqStatus.status === "fulfilled" ? dlqStatus.value : null;

  const allHealthy = redis.healthy && db.healthy;
  const dlqDepth = dlq?.depth ?? 0;
  const queueAlert = dlqDepth > 50; // Alert when DLQ has >50 jobs

  return NextResponse.json(
    {
      status: allHealthy ? (queueAlert ? "degraded" : "ok") : "degraded",
      redis,
      db,
      pool:  poolMetrics,
      cache: cacheMetrics,
      queues,
      dlq: { depth: dlqDepth, alert: queueAlert },
      timestamp: new Date().toISOString(),
    },
    { status: allHealthy ? 200 : 503 }
  );
}
