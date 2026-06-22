// ============================================================
// Inngest function — Integration Sync (Zoho CRM/Books/Inventory, etc.)
// Replaces the BullMQ sync worker. Handles pagination, retries, token
// refresh, rate limits, incremental sync and per-entity logging inside
// processSync(). Inngest owns the retry budget (5 attempts).
// ============================================================

import { inngest } from "@/inngest/client";
import { EVENTS } from "@/inngest/events";
import { processSync } from "@/lib/jobs/processors/sync-processor";
import { startBackgroundJob } from "@/lib/jobs/background-job";
import type { SyncJobData } from "@/lib/jobs/queues";

export const integrationSync = inngest.createFunction(
  {
    id: "integration-sync",
    name: "Integration Sync",
    concurrency: 5,
    retries: 5,
    triggers: [{ event: EVENTS.INTEGRATION_SYNC_REQUESTED }],
  },
  async ({ event, step, runId, attempt }) => {
    const data = event.data as SyncJobData;

    const bg = await startBackgroundJob({
      type: "integration.sync",
      organizationId: data.organizationId,
      referenceId: data.syncJobId,
      idempotencyKey: `integration.sync:${data.syncJobId}`,
      eventName: event.name,
      eventId: event.id,
      runId,
      attempt: attempt + 1,
      metadata: { integrationId: data.integrationId, connectorType: data.connectorType },
    });

    try {
      await step.run("run-sync", () => processSync(data, (progress) => bg.setProgress(progress)));
      await bg.complete();
      return { syncJobId: data.syncJobId, status: "COMPLETED" };
    } catch (err) {
      await bg.fail(err);
      throw err;
    }
  }
);
