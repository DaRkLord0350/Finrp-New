// ============================================================
// Inngest function — Inbound Webhook processing (Zoho)
// Replaces the BullMQ webhook worker. Signature verification +
// idempotency (dedupe of duplicate deliveries) happen in the receiving
// route; this function processes the stored WebhookEvent with safe
// retries and persisted processing status.
// ============================================================

import { inngest } from "@/inngest/client";
import { EVENTS } from "@/inngest/events";
import { processWebhookEvent } from "@/lib/jobs/processors/webhook-processor";
import { startBackgroundJob } from "@/lib/jobs/background-job";
import type { WebhookJobData } from "@/lib/jobs/queues";

export const webhookZoho = inngest.createFunction(
  {
    id: "webhook-zoho",
    name: "Webhook — Zoho",
    concurrency: 10,
    retries: 5,
    triggers: [{ event: EVENTS.WEBHOOK_ZOHO_RECEIVED }],
  },
  async ({ event, step, runId, attempt }) => {
    const data = event.data as WebhookJobData;

    const bg = await startBackgroundJob({
      type: "webhook.zoho",
      organizationId: data.organizationId,
      referenceId: data.webhookEventId,
      idempotencyKey: `webhook.zoho:${data.webhookEventId}`,
      eventName: event.name,
      eventId: event.id,
      runId,
      attempt: attempt + 1,
      metadata: { eventType: data.eventType },
    });

    try {
      await step.run("process-webhook", () => processWebhookEvent(data));
      await bg.complete();
      return { webhookEventId: data.webhookEventId, status: "PROCESSED" };
    } catch (err) {
      await bg.fail(err);
      throw err;
    }
  }
);
