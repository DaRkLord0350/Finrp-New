// ============================================================
// Dead Letter Queue
//
// Failed jobs that exceed their retry budget are moved here.
// The DLQ is a regular BullMQ Queue — failed jobs are added
// as new jobs with the original data + failure metadata.
//
// Operators can:
//   • Inspect the DLQ via Bull Board or the /api/health endpoint
//   • Replay jobs by moving them back to the original queue
//   • Alert on DLQ depth in monitoring
//
// Usage in worker:
//   worker.on("failed", async (job, err) => {
//     if (job.attemptsMade >= job.opts.attempts) {
//       await enqueueDlq({ queue: QUEUE_NAMES.IMPORT, job, error: err });
//     }
//   });
// ============================================================

import { Queue } from "bullmq";
import { getRedisConnection } from "@/lib/redis";

export const DLQ_NAME = "finrp-dlq" as const;

export interface DlqJobData {
  originalQueue: string;
  originalJobId: string;
  payload: unknown;
  failedAt: string;
  errorMessage: string;
  attemptsMade: number;
  organizationId?: string;
}

let dlqInstance: Queue<DlqJobData> | null = null;

export function getDlq(): Queue<DlqJobData> {
  if (!dlqInstance) {
    dlqInstance = new Queue<DlqJobData>(DLQ_NAME, {
      connection: getRedisConnection("queue"),
      defaultJobOptions: {
        // DLQ jobs are kept until manually cleared
        removeOnComplete: false,
        removeOnFail: false,
        attempts: 1, // DLQ jobs are NOT retried automatically
      },
    });
  }
  return dlqInstance;
}

export async function enqueueDlq(params: {
  originalQueue: string;
  originalJobId: string | undefined;
  payload: unknown;
  error: Error;
  attemptsMade: number;
  organizationId?: string;
}): Promise<void> {
  try {
    const dlq = getDlq();
    await dlq.add("dead-letter", {
      originalQueue: params.originalQueue,
      originalJobId: params.originalJobId ?? "unknown",
      payload: params.payload,
      failedAt: new Date().toISOString(),
      errorMessage: params.error.message,
      attemptsMade: params.attemptsMade,
      organizationId: params.organizationId,
    });
    console.warn(
      `[DLQ] Moved failed job to DLQ: ` +
      `queue=${params.originalQueue} jobId=${params.originalJobId} ` +
      `error=${params.error.message.slice(0, 100)}`
    );
  } catch (dlqErr) {
    // DLQ failure is non-fatal — log and continue
    console.error("[DLQ] Failed to enqueue to DLQ:", (dlqErr as Error).message);
  }
}

export async function getDlqHealth() {
  try {
    const dlq = getDlq();
    const counts = await dlq.getJobCounts("waiting", "failed", "completed");
    return { depth: counts.waiting + counts.failed, ...counts };
  } catch {
    return { depth: -1, error: "DLQ unavailable" };
  }
}
