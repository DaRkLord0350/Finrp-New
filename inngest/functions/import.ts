// ============================================================
// Inngest function — CSV/Excel Import
// Replaces the BullMQ import worker. Flow:
//   csv/import.requested → process (parse → validate → import →
//   progress) → mark complete → emit csv/import.completed
// ============================================================

import { inngest } from "@/inngest/client";
import { EVENTS } from "@/inngest/events";
import { processImport } from "@/lib/jobs/processors/import-processor";
import { startBackgroundJob } from "@/lib/jobs/background-job";
import type { ImportJobData } from "@/lib/jobs/queues";

export const csvImport = inngest.createFunction(
  {
    id: "csv-import",
    name: "CSV/Excel Import",
    // Bounded fan-out mirrors the old worker concurrency=3.
    concurrency: 3,
    retries: 3,
    triggers: [{ event: EVENTS.CSV_IMPORT_REQUESTED }],
  },
  async ({ event, step, runId, attempt }) => {
    const data = event.data as ImportJobData;

    const bg = await startBackgroundJob({
      type: "csv.import",
      organizationId: data.organizationId,
      referenceId: data.importJobId,
      idempotencyKey: `csv.import:${data.importJobId}`,
      eventName: event.name,
      eventId: event.id,
      runId,
      attempt: attempt + 1,
      metadata: { entity: data.entity },
    });

    try {
      const result = await step.run("process-import", () =>
        processImport(data, (progress) => bg.setProgress(progress))
      );

      await bg.complete(result);

      // Fan-out completion event for any downstream listeners.
      await step.sendEvent("import-completed", {
        name: EVENTS.CSV_IMPORT_COMPLETED,
        data: {
          importJobId: data.importJobId,
          organizationId: data.organizationId,
          status: "COMPLETED",
        },
      });

      return result;
    } catch (err) {
      await bg.fail(err);
      throw err;
    }
  }
);
