// ============================================================
// JobManager Service — queue observability for /admin/jobs
// ============================================================

import { getImportQueue, getSyncQueue, getWebhookQueue } from "@/lib/jobs/queues";
import { getDlq, DLQ_NAME } from "@/lib/jobs/queues/dlq";
import { prisma } from "@/lib/prisma";

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

export async function getJobManagerData() {
  const [importQ, syncQ, webhookQ, dlq] = [
    getImportQueue(),
    getSyncQueue(),
    getWebhookQueue(),
    getDlq(),
  ];

  const [importCounts, syncCounts, webhookCounts, dlqCounts] = await Promise.all([
    importQ.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
    syncQ.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
    webhookQ.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
    dlq.getJobCounts("waiting", "failed", "completed"),
  ]);

  const queues: QueueStats[] = [
    { name: "import", ...importCounts as Record<string, number>, delayed: importCounts.delayed ?? 0 } as QueueStats,
    { name: "sync", ...syncCounts as Record<string, number>, delayed: syncCounts.delayed ?? 0 } as QueueStats,
    { name: "webhook", ...webhookCounts as Record<string, number>, delayed: webhookCounts.delayed ?? 0 } as QueueStats,
  ];

  // Get DLQ jobs (recent failures)
  const dlqJobs = await dlq.getJobs(["waiting", "failed"], 0, 20);
  const dlqItems: DlqJob[] = dlqJobs.map((j) => ({
    id: j.id ?? "",
    originalQueue: j.data.originalQueue,
    originalJobId: j.data.originalJobId,
    errorMessage: j.data.errorMessage,
    failedAt: j.data.failedAt,
    attemptsMade: j.data.attemptsMade,
    organizationId: j.data.organizationId,
  }));

  // Get active import jobs from DB (for progress tracking)
  const activeImports = await prisma.importJob.findMany({
    where: { status: { in: ["QUEUED", "MAPPING", "VALIDATING", "PROCESSING"] } },
    select: {
      id: true, status: true, entity: true, totalRows: true, processedRows: true,
      createdAt: true, organizationId: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Get stuck jobs (MAPPING/VALIDATING for > 10 minutes)
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

  const dlqDepth = (dlqCounts.waiting ?? 0) + (dlqCounts.failed ?? 0);

  return {
    queues,
    dlq: {
      depth: dlqDepth,
      jobs: dlqItems,
    },
    activeImports,
    stuckJobs,
    totalFailed: queues.reduce((s, q) => s + q.failed, 0),
    totalActive: queues.reduce((s, q) => s + q.active, 0),
    totalWaiting: queues.reduce((s, q) => s + q.waiting, 0),
  };
}

export async function retryDlqJob(jobId: string): Promise<void> {
  const dlq = getDlq();
  const job = await dlq.getJob(jobId);
  if (!job) throw new Error("DLQ job not found");
  await job.retry();
}

export async function clearStuckJob(importJobId: string): Promise<void> {
  await prisma.importJob.update({
    where: { id: importJobId },
    data: { status: "FAILED", error: "Manually cleared by admin", failedAt: new Date() },
  });
}
