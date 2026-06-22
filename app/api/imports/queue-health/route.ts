// ============================================================
// GET /api/imports/queue-health
// Production observability for the import pipeline.
// Returns BackgroundJob ledger depths + stuck imports + health.
// (Inngest owns execution; depths are read from the DB ledger.)
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const QUEUED_STUCK_MS     = 5  * 60 * 1000;
const PROCESSING_STUCK_MS = 5  * 60 * 1000;
const MAPPING_STUCK_MS    = 10 * 60 * 1000;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();

  // ── BackgroundJob ledger state (type = csv.import, tenant-scoped) ──────────
  let queueCounts: Record<string, number> = {};
  let queueError: string | null = null;
  let activeJobs: unknown[] = [];
  let waitingJobs: unknown[] = [];
  let activeWorkers = 0;

  try {
    const ledgerWhere = { type: "csv.import", organizationId: user.organizationId };
    const [grouped, active, waiting] = await Promise.all([
      prisma.backgroundJob.groupBy({ by: ["status"], where: ledgerWhere, _count: { _all: true } }),
      prisma.backgroundJob.findMany({
        where: { ...ledgerWhere, status: { in: ["RUNNING", "RETRYING"] } },
        select: { id: true, referenceId: true, progress: true, attempts: true, startedAt: true },
        take: 20,
        orderBy: { startedAt: "desc" },
      }),
      prisma.backgroundJob.findMany({
        where: { ...ledgerWhere, status: "QUEUED" },
        select: { id: true, referenceId: true, createdAt: true },
        take: 20,
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const by = Object.fromEntries(grouped.map((g) => [g.status, g._count._all])) as Record<string, number>;
    queueCounts = {
      waiting: by.QUEUED ?? 0,
      active: (by.RUNNING ?? 0) + (by.RETRYING ?? 0),
      completed: by.COMPLETED ?? 0,
      failed: by.FAILED ?? 0,
      delayed: 0,
      paused: 0,
    };

    activeJobs = active.map((j) => ({
      id: j.id,
      importJobId: j.referenceId,
      progress: j.progress,
      attemptsMade: j.attempts,
      timestamp: j.startedAt?.getTime(),
    }));
    waitingJobs = waiting.map((j) => ({
      id: j.id,
      importJobId: j.referenceId,
      timestamp: j.createdAt.getTime(),
    }));
    activeWorkers = active.length; // proxy for in-flight runs
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
      name:          "csv.import",
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
        ...(queueError ? [`Ledger error: ${queueError}`] : []),
        ...(stuckQueued.length   ? [`${stuckQueued.length} import(s) stuck in QUEUED`] : []),
        ...(stuckProcessing.length ? [`${stuckProcessing.length} import(s) stuck in PROCESSING (heartbeat stale)`] : []),
        ...(stuckMapping.length  ? [`${stuckMapping.length} import(s) stuck in MAPPING >10 min`] : []),
      ],
    },
    timestamp: new Date().toISOString(),
  });
}
