// ============================================================
// lib/tax/queue.ts
//
// BullMQ queue for heavy tax computations (GSTR generation, 2B
// reconciliation, filing status polling). Mirrors the banking queue
// pattern. A TaxJobRun row tracks each dispatch for the admin monitor.
// ============================================================

import { Queue } from "bullmq";
import { getRedisConnection } from "@/lib/redis";
import { QUEUE_NAMES } from "@/lib/jobs/queues";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type TaxJobName =
  | "gst.generateGstr1"
  | "gst.computeGstr3b"
  | "gst.reconcile2b"
  | "filing.refreshStatus";

export interface TaxJobData {
  jobName: TaxJobName;
  organizationId: string;
  gstin: string;
  period: string;
  triggeredById?: string;
  meta?: Record<string, unknown>;
}

const TAX_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 3000 },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 500 },
};

let taxQueue: Queue<TaxJobData> | null = null;

export function getTaxQueue(): Queue<TaxJobData> {
  if (!taxQueue) {
    taxQueue = new Queue<TaxJobData>(QUEUE_NAMES.TAX, {
      connection: getRedisConnection("queue"),
      defaultJobOptions: TAX_JOB_OPTIONS,
    });
  }
  return taxQueue;
}

/**
 * Enqueue a tax compute job + record a TaxJobRun for monitoring.
 * Deterministic jobId per (jobName, gstin, period) so duplicate clicks
 * don't double-process.
 */
export async function enqueueTaxJob(data: TaxJobData): Promise<string> {
  const q = getTaxQueue();
  const jobId = `${data.jobName}_${data.gstin}_${data.period}`;

  await prisma.taxJobRun.create({
    data: {
      organizationId: data.organizationId,
      queue: QUEUE_NAMES.TAX,
      jobName: data.jobName,
      jobId,
      status: "QUEUED",
      payload: { gstin: data.gstin, period: data.period, ...data.meta } as unknown as Prisma.InputJsonValue,
    },
  });

  const job = await q.add(data.jobName, data, { jobId });
  return job.id ?? jobId;
}

export async function markJobRunning(jobId: string) {
  await prisma.taxJobRun.updateMany({
    where: { jobId, status: { in: ["QUEUED", "FAILED"] } },
    data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 } },
  });
}

export async function markJobDone(jobId: string, result: Record<string, unknown>) {
  await prisma.taxJobRun.updateMany({
    where: { jobId },
    data: { status: "COMPLETED", finishedAt: new Date(), result: result as unknown as Prisma.InputJsonValue },
  });
}

export async function markJobFailed(jobId: string, errorMessage: string) {
  await prisma.taxJobRun.updateMany({
    where: { jobId },
    data: { status: "FAILED", finishedAt: new Date(), errorMessage },
  });
}
