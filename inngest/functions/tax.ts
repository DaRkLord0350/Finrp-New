// ============================================================
// Inngest function — Tax compute (GST GSTR-1 / GSTR-3B / 2B reconcile /
// filing status). Replaces the BullMQ tax worker. Advances the
// TaxJobRun row (admin monitor) and dispatches by jobName to the GST
// engine. Inngest owns retries (3).
// ============================================================

import { inngest } from "@/inngest/client";
import { EVENTS } from "@/inngest/events";
import { startBackgroundJob } from "@/lib/jobs/background-job";
import { markJobRunning, markJobDone, markJobFailed, type TaxJobData } from "@/lib/tax/queue";
import { generateGstr1 } from "@/lib/tax/gst/gstr1";
import { computeGstr3b } from "@/lib/tax/gst/gstr3b";
import { reconcile2b } from "@/lib/tax/gst/reconcile";
import { getFilingProvider } from "@/lib/tax/filing/factory";

async function dispatch(data: TaxJobData): Promise<Record<string, unknown>> {
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

export const taxJob = inngest.createFunction(
  {
    id: "tax-job",
    name: "Tax Compute",
    concurrency: 2,
    retries: 3,
    triggers: [{ event: EVENTS.TAX_JOB_REQUESTED }],
  },
  async ({ event, step, runId, attempt }) => {
    const data = event.data as TaxJobData;
    const jobId = `${data.jobName}_${data.gstin}_${data.period}`;

    const bg = await startBackgroundJob({
      type: `tax.${data.jobName}`,
      organizationId: data.organizationId,
      referenceId: jobId,
      idempotencyKey: `tax:${jobId}`,
      eventName: event.name,
      eventId: event.id,
      runId,
      attempt: attempt + 1,
      metadata: { gstin: data.gstin, period: data.period },
    });

    await step.run("mark-running", () => markJobRunning(jobId));

    try {
      const result = await step.run("compute", () => dispatch(data));
      await step.run("mark-done", () => markJobDone(jobId, result));
      await bg.complete(result);
      return result;
    } catch (err) {
      await step.run("mark-failed", () => markJobFailed(jobId, (err as Error).message));
      await bg.fail(err);
      throw err;
    }
  }
);
