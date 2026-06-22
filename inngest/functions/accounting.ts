// ============================================================
// Inngest function — Bulk Account Update
// Replaces the BullMQ accounting-bulk worker. Replaces all references
// to fromAccountId with toAccountId across selected source documents
// (tenant-scoped) with progress tracking on BulkAccountUpdateJob.
// ============================================================

import { inngest } from "@/inngest/client";
import { EVENTS } from "@/inngest/events";
import { startBackgroundJob } from "@/lib/jobs/background-job";
import {
  runBulkAccountUpdate,
  type BulkAccountUpdateJobData,
} from "@/lib/accounting/workers/bulk-account-update.worker";

export const bulkAccountUpdate = inngest.createFunction(
  {
    id: "accounting-bulk-update",
    name: "Bulk Account Update",
    concurrency: 1,
    retries: 2,
    triggers: [{ event: EVENTS.ACCOUNTING_BULK_UPDATE_REQUESTED }],
  },
  async ({ event, step, runId, attempt }) => {
    const data = event.data as BulkAccountUpdateJobData;

    const bg = await startBackgroundJob({
      type: "accounting.bulk-update",
      organizationId: data.organizationId,
      referenceId: data.jobId,
      idempotencyKey: `accounting.bulk-update:${data.jobId}`,
      eventName: event.name,
      eventId: event.id,
      runId,
      attempt: attempt + 1,
    });

    try {
      await step.run("run-bulk-update", () => runBulkAccountUpdate(data.jobId));
      await bg.complete();
      return { jobId: data.jobId, status: "COMPLETED" };
    } catch (err) {
      await bg.fail(err);
      throw err;
    }
  }
);
