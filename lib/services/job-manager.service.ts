// ============================================================
// JobManager Service — background-job observability for /admin/jobs
//
// Reads the BackgroundJob ledger (written by Inngest functions) plus
// the ImportJob table. The on-screen shape is unchanged; "DLQ" is now
// simply the set of FAILED background jobs. Detailed run history /
// replay also lives in the Inngest dashboard.
// ============================================================

import { prisma } from "@/lib/prisma";
import { enqueueImport } from "@/lib/jobs/queues";

export type QueueStats = {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
};

export type DlqJob = {
  id: string;
  originalQueue: string;
  originalJobId: string;
  errorMessage: string;
  failedAt: string;
  attemptsMade: number;
  organizationId?: string;
};

export type ActiveJob = {
  id: string;
  queue: string;
  data: Record<string, unknown>;
  progress: number;
  timestamp: number;
};

// Map a logical "queue" name → the BackgroundJob.type it corresponds to.
const QUEUE_TYPES: Record<string, string> = {
  import: "csv.import",
  sync: "integration.sync",
  webhook: "webhook.zoho",
};

async function statsForType(type: string, name: string): Promise<QueueStats> {
  const grouped = await prisma.backgroundJob.groupBy({
    by: ["status"],
    where: { type },
    _count: { _all: true },
  });
  const by = Object.fromEntries(grouped.map((g) => [g.status, g._count._all])) as Record<string, number>;
  return {
    name,
    waiting: by.QUEUED ?? 0,
    active: (by.RUNNING ?? 0) + (by.RETRYING ?? 0),
    completed: by.COMPLETED ?? 0,
    failed: by.FAILED ?? 0,
    delayed: 0,
  };
}

export async function getJobManagerData() {
  const queues: QueueStats[] = await Promise.all(
    Object.entries(QUEUE_TYPES).map(([name, type]) => statsForType(type, name))
  );

  // DLQ = recent FAILED background jobs across every type.
  const [dlqDepth, dlqRows] = await Promise.all([
    prisma.backgroundJob.count({ where: { status: "FAILED" } }),
    prisma.backgroundJob.findMany({
      where: { status: "FAILED" },
      orderBy: { completedAt: "desc" },
      take: 20,
      select: {
        id: true,
        type: true,
        referenceId: true,
        error: true,
        completedAt: true,
        attempts: true,
        organizationId: true,
      },
    }),
  ]);

  const dlqItems: DlqJob[] = dlqRows.map((j) => ({
    id: j.id,
    originalQueue: j.type,
    originalJobId: j.referenceId ?? j.id,
    errorMessage: j.error ?? "",
    failedAt: (j.completedAt ?? new Date()).toISOString(),
    attemptsMade: j.attempts,
    organizationId: j.organizationId ?? undefined,
  }));

  // Active import jobs from DB (for progress tracking).
  const activeImports = await prisma.importJob.findMany({
    where: { status: { in: ["QUEUED", "MAPPING", "VALIDATING", "PROCESSING"] } },
    select: {
      id: true,
      status: true,
      entity: true,
      totalRows: true,
      processedRows: true,
      createdAt: true,
      organizationId: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Stuck jobs (QUEUED/MAPPING/VALIDATING/PROCESSING for > 10 minutes).
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const stuckJobs = await prisma.importJob.findMany({
    where: {
      status: { in: ["QUEUED", "MAPPING", "VALIDATING", "PROCESSING"] },
      updatedAt: { lt: tenMinutesAgo },
    },
    select: { id: true, status: true, entity: true, createdAt: true, updatedAt: true, organizationId: true },
    orderBy: { updatedAt: "asc" },
    take: 10,
  });

  return {
    queues,
    dlq: { depth: dlqDepth, jobs: dlqItems },
    activeImports,
    stuckJobs,
    totalFailed: queues.reduce((s, q) => s + q.failed, 0),
    totalActive: queues.reduce((s, q) => s + q.active, 0),
    totalWaiting: queues.reduce((s, q) => s + q.waiting, 0),
  };
}

/**
 * Re-dispatch a failed background job. Import jobs (the common DLQ case) are
 * re-enqueued automatically; other job types are surfaced for re-running from
 * their own module or the Inngest dashboard.
 */
export async function retryDlqJob(jobId: string): Promise<void> {
  const job = await prisma.backgroundJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");

  if (job.type === "csv.import" && job.referenceId) {
    const imp = await prisma.importJob.findUnique({
      where: { id: job.referenceId },
      select: { id: true, organizationId: true, entity: true },
    });
    if (!imp) throw new Error("Underlying import no longer exists");
    await enqueueImport({
      importJobId: imp.id,
      organizationId: imp.organizationId,
      entity: imp.entity,
      options: { skipDuplicates: true, updateExisting: true, dryRun: false },
    });
    await prisma.backgroundJob.update({ where: { id: jobId }, data: { status: "RETRYING" } });
    return;
  }

  throw new Error(
    `Automatic retry isn't supported for "${job.type}" jobs — re-run it from its module or the Inngest dashboard.`
  );
}

export async function clearStuckJob(importJobId: string): Promise<void> {
  await prisma.importJob.update({
    where: { id: importJobId },
    data: { status: "FAILED", error: "Manually cleared by admin", failedAt: new Date() },
  });
}
