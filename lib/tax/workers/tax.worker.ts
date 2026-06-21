// ============================================================
// lib/tax/workers/tax.worker.ts
//
// BullMQ worker for heavy tax computations. Dispatches by job name to
// the GST engine, records TaxJobRun status, and routes exhausted jobs
// to the shared DLQ. Mirrors the import/bank worker conventions.
// ============================================================

import { Worker } from "bullmq";
import { getRedisConnection } from "@/lib/redis";
import { QUEUE_NAMES } from "@/lib/jobs/queues";
import { enqueueDlq } from "@/lib/jobs/queues/dlq";
import type { TaxJobData } from "@/lib/tax/queue";
import { markJobRunning, markJobDone, markJobFailed } from "@/lib/tax/queue";
import { generateGstr1 } from "@/lib/tax/gst/gstr1";
import { computeGstr3b } from "@/lib/tax/gst/gstr3b";
import { reconcile2b } from "@/lib/tax/gst/reconcile";
import { getFilingProvider } from "@/lib/tax/filing/factory";

async function process(data: TaxJobData): Promise<Record<string, unknown>> {
  const { organizationId, gstin, period } = data;
  switch (data.jobName) {
    case "gst.generateGstr1": {
      const { result } = await generateGstr1(organizationId, gstin, period, data.triggeredById);
      return { ...result.summary };
    }
    case "gst.computeGstr3b": {
      const { result } = await computeGstr3b(organizationId, gstin, period, data.triggeredById);
      return { netPayable: result.netPayable, closing: result.closing };
    }
    case "gst.reconcile2b": {
      const r = await reconcile2b(organizationId, gstin, period, data.triggeredById);
      return { ...r };
    }
    case "filing.refreshStatus": {
      const provider = getFilingProvider();
      const status = await provider.fetchStatus({ gstin, returnType: "GSTR1", period });
      return { providerStatus: status.status, arn: status.arn };
    }
    default:
      throw new Error(`Unknown tax job: ${(data as TaxJobData).jobName}`);
  }
}

export function createTaxWorker(): Worker<TaxJobData> {
  const worker = new Worker<TaxJobData>(
    QUEUE_NAMES.TAX,
    async (job) => {
      const jobId = job.id ?? `${job.data.jobName}_${job.data.gstin}_${job.data.period}`;
      await markJobRunning(jobId);
      try {
        const result = await process(job.data);
        await markJobDone(jobId, result);
        return result;
      } catch (err) {
        await markJobFailed(jobId, (err as Error).message);
        throw err;
      }
    },
    { connection: getRedisConnection("worker"), concurrency: 2 }
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await enqueueDlq({
        originalQueue: QUEUE_NAMES.TAX,
        originalJobId: job.id,
        payload: job.data,
        error: err,
        attemptsMade: job.attemptsMade,
        organizationId: job.data.organizationId,
      });
    }
  });

  worker.on("error", (err) => console.error("[tax-worker] error:", err.message));
  return worker;
}
