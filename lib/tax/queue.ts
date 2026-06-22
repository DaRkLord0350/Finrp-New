// ============================================================
// lib/tax/queue.ts
//
// Tax compute dispatch (Inngest-backed). enqueueTaxJob records a
// TaxJobRun row (the admin monitor reads it) and emits a
// `tax/job.requested` event. The tax Inngest function dispatches by
// jobName to the GST engine and advances the TaxJobRun via the
// markJob* helpers below. Deterministic event id per (jobName, gstin,
// period) so duplicate clicks don't double-process.
// ============================================================

import { inngest } from "@/inngest/client";
import { EVENTS } from "@/inngest/events";
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

/**
 * Record a TaxJobRun for monitoring and emit the compute event.
 * Deterministic event id collapses duplicate dispatches.
 */
export async function enqueueTaxJob(data: TaxJobData): Promise<string> {
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

  await inngest.send({ name: EVENTS.TAX_JOB_REQUESTED, data, id: jobId });
  return jobId;
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
