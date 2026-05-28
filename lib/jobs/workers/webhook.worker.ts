// ============================================================
// FinRP — Webhook BullMQ Worker
// Processes inbound WebhookEvent records from external systems.
// Currently handles Zoho webhook payloads (CRM / Books).
// Extend with additional sources by adding cases to processEvent().
// ============================================================

import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "@/lib/redis";
import { QUEUE_NAMES, type WebhookJobData, enqueueSync } from "@/lib/jobs/queues";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

export function createWebhookWorker() {
  const worker = new Worker<WebhookJobData>(
    QUEUE_NAMES.WEBHOOK,
    async (job: Job<WebhookJobData>) => {
      return processWebhookJob(job);
    },
    {
      connection: getRedisConnection("worker"),
      concurrency: 10,        // webhooks are lightweight, high concurrency ok
      limiter: {
        max: 100,
        duration: 60_000,
      },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[WebhookWorker] ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[WebhookWorker] ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[WebhookWorker] Error:", err);
  });

  return worker;
}

// ---------------------------------------------------------------------------
// Core processor
// ---------------------------------------------------------------------------

async function processWebhookJob(job: Job<WebhookJobData>): Promise<void> {
  const { webhookEventId, organizationId, integrationId, source, eventType } = job.data;

  // ── 1. Fetch the event record ──
  const event = await prisma.webhookEvent.findUnique({
    where: { id: webhookEventId },
  });

  if (!event) {
    throw new Error(`WebhookEvent ${webhookEventId} not found`);
  }
  if (event.organizationId !== organizationId) {
    throw new Error("WebhookEvent does not belong to this organization");
  }
  if (event.status === "PROCESSED") {
    console.warn(`[WebhookWorker] Event ${webhookEventId} already processed`);
    return;
  }

  // ── 2. Mark as PROCESSING ──
  await prisma.webhookEvent.update({
    where: { id: webhookEventId },
    data: { status: "PROCESSING" },
  });

  try {
    await processEvent({
      source,
      eventType,
      payload: event.payload as Record<string, unknown>,
      organizationId,
      integrationId,
    });

    // ── 3. Mark as PROCESSED ──
    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: "FAILED",
        error: message,
      },
    });

    throw err; // Trigger BullMQ retry
  }
}

// ---------------------------------------------------------------------------
// Route events by source + type
// ---------------------------------------------------------------------------

interface EventContext {
  source: string;
  eventType: string;
  payload: Record<string, unknown>;
  organizationId: string;
  integrationId: string;
}

async function processEvent(ctx: EventContext): Promise<void> {
  switch (ctx.source.toLowerCase()) {
    case "zoho":
      return processZohoWebhook(ctx);
    default:
      console.warn(`[WebhookWorker] Unknown webhook source: ${ctx.source}`);
  }
}

// ---------------------------------------------------------------------------
// Zoho Webhook Handlers
// ---------------------------------------------------------------------------

async function processZohoWebhook(ctx: EventContext): Promise<void> {
  const { eventType, payload, organizationId, integrationId } = ctx;

  // Zoho CRM events: module.event format (e.g. "Contacts.create", "Invoices.edit")
  const [module, action] = eventType.split(".").map((s) => s.toLowerCase());

  if (!module || !action) {
    console.warn(`[WebhookWorker] Unrecognized Zoho event type: ${eventType}`);
    return;
  }

  // Map Zoho module → FinRP entity
  const entityMap: Record<string, string> = {
    contacts: "customers",
    leads: "customers",
    accounts: "customers",
    invoices: "invoices",
    products: "products",
    items: "products",
  };

  const entity = entityMap[module];

  if (!entity) {
    console.info(`[WebhookWorker] No handler for Zoho module: ${module}`);
    return;
  }

  // For create/edit/delete events, trigger an incremental sync for that entity
  if (["create", "edit", "delete", "update"].includes(action)) {
    const syncJobId = `wh-sync-${organizationId}-${Date.now()}`;

    // Create a SyncJob record first
    const syncJob = await prisma.syncJob.create({
      data: {
        id: syncJobId,
        organizationId,
        integrationId,
        type: "INCREMENTAL",
        entity,
        status: "QUEUED",
        triggeredBy: "webhook",
        scheduledAt: new Date(),
      },
    });

    await enqueueSync({
      syncJobId: syncJob.id,
      organizationId,
      integrationId,
      connectorType: "ZOHO",
      entity,
      isIncremental: true,
    }, 1000); // Small delay to batch rapid webhook bursts

    console.info(
      `[WebhookWorker] Triggered incremental sync for ${entity} via Zoho ${eventType}`
    );
  }
}
