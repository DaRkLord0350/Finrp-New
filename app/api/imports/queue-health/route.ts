// ============================================================
// GET /api/imports/queue-health
// Production observability for the import pipeline.
// Returns BullMQ queue depths + stuck imports + worker health.
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getImportQueue } from "@/lib/jobs/queues";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const QUEUED_STUCK_MS     = 5  * 60 * 1000;
const PROCESSING_STUCK_MS = 5  * 60 * 1000;
const MAPPING_STUCK_MS    = 10 * 60 * 1000;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();

  // ── BullMQ queue state ────────────────────────────────────────────────────
  let queueCounts: Record<string, number> = {};
  let queueError: string | null = null;
  let activeJobs: unknown[] = [];
  let waitingJobs: unknown[] = [];
  let activeWorkers = 0;

  try {
    const q = getImportQueue();
    queueCounts = await q.getJobCounts(
      "waiting", "active", "completed", "failed", "delayed", "paused"
    );

    const [active, waiting] = await Promise.all([
      q.getActive(0, 20),
      q.getWaiting(0, 20),
    ]);

    activeJobs = active.map((j) => ({
      id:           j.id,
      importJobId:  (j.data as { importJobId?: string }).importJobId,
      organizationId: (j.data as { organizationId?: string }).organizationId,
      entity:       (j.data as { entity?: string }).entity,
      progress:     j.progress,
      attemptsMade: j.attemptsMade,
      timestamp:    j.timestamp,
    }));

    waitingJobs = waiting.map((j) => ({
      id:          j.id,
      importJobId: (j.data as { importJobId?: string }).importJobId,
      entity:      (j.data as { entity?: string }).entity,
      timestamp:   j.timestamp,
    }));

    activeWorkers = active.length; // proxy for active workers
  } catch (err) {
    queueError = err instanceof Error ? err.message : String(err);
  }

  // ── Stuck imports ─────────────────────────────────────────────────────────
  const now = Date.now();
  const queuedCutoff     = new Date(now - QUEUED_STUCK_MS);
  const processingCutoff = new Date(now - PROCESSING_STUCK_MS);
  const mappingCutoff    = new Date(now - MAPPING_STUCK_MS);

  const [stuckQueued, stuckProcessing, stuckMapping, recentFailed] = await Promise.all([
    (prisma as any).importJob.findMany({
      where: {
        organizationId: user.organizationId,
        status: "QUEUED",
        updatedAt: { lt: queuedCutoff },
      },
      select: {
        id: true, status: true, entity: true, fileName: true,
        createdAt: true, updatedAt: true, queuedAt: true,
        bullmqJobId: true, retryCount: true, error: true,
      },
      take: 20,
      orderBy: { updatedAt: "asc" },
    }),

    (prisma as any).importJob.findMany({
      where: {
        organizationId: user.organizationId,
        status: "PROCESSING",
        OR: [
          { lastHeartbeatAt: { lt: processingCutoff } },
          { AND: [{ lastHeartbeatAt: null }, { startedAt: { lt: processingCutoff } }] },
        ],
      },
      select: {
        id: true, status: true, entity: true, fileName: true,
        startedAt: true, lastHeartbeatAt: true, bullmqJobId: true,
        retryCount: true, error: true,
      },
      take: 20,
    }),

    (prisma as any).importJob.findMany({
      where: {
        organizationId: user.organizationId,
        status: "MAPPING",
        updatedAt: { lt: mappingCutoff },
      },
      select: {
        id: true, status: true, entity: true, fileName: true,
        createdAt: true, updatedAt: true,
      },
      take: 20,
      orderBy: { updatedAt: "asc" },
    }),

    (prisma as any).importJob.findMany({
      where: {
        organizationId: user.organizationId,
        status: "FAILED",
      },
      select: {
        id: true, entity: true, fileName: true, error: true,
        failedAt: true, updatedAt: true, bullmqJobId: true, retryCount: true,
      },
      take: 10,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  // ── DB stats ──────────────────────────────────────────────────────────────
  const dbStats = await (prisma as any).importJob.groupBy({
    by: ["status"],
    where: { organizationId: user.organizationId },
    _count: { _all: true },
  });

  const statusCounts = Object.fromEntries(
    (dbStats as Array<{ status: string; _count: { _all: number } }>)
      .map((r) => [r.status, r._count._all])
  );

  const stuckImports = [
    ...stuckQueued.map((j: unknown) => ({ ...(j as object), stuckReason: "QUEUED > 5 min" })),
    ...stuckProcessing.map((j: unknown) => ({ ...(j as object), stuckReason: "PROCESSING heartbeat stale" })),
    ...stuckMapping.map((j: unknown) => ({ ...(j as object), stuckReason: "MAPPING > 10 min (user action needed)" })),
  ];

  return NextResponse.json({
    queue: {
      name:          "finrp-import",
      counts:        queueCounts,
      activeJobs,
      waitingJobs,
      activeWorkers,
      error:         queueError,
    },
    db: {
      statusCounts,
      stuckImports,
      recentFailed,
    },
    health: {
      isHealthy: queueError === null && stuckImports.length === 0,
      issues: [
        ...(queueError ? [`Redis error: ${queueError}`] : []),
        ...(stuckQueued.length   ? [`${stuckQueued.length} import(s) stuck in QUEUED`] : []),
        ...(stuckProcessing.length ? [`${stuckProcessing.length} import(s) stuck in PROCESSING (heartbeat stale)`] : []),
        ...(stuckMapping.length  ? [`${stuckMapping.length} import(s) stuck in MAPPING >10 min`] : []),
      ],
    },
    timestamp: new Date().toISOString(),
  });
}
