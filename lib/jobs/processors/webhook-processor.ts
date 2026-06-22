// ============================================================
// FinRP — Inbound Webhook processor
// Processes a stored WebhookEvent (currently Zoho CRM/Books). Verifies
// the event hasn't already been processed (idempotent), routes by
// source/type, and triggers an incremental sync for affected entities.
// Ported from the former BullMQ webhook worker; invoked by the
// webhook-zoho Inngest function.
// ============================================================

import { prisma } from "@/lib/prisma";
import { enqueueSync, type WebhookJobData } from "@/lib/jobs/queues";

export async function processWebhookEvent(data: WebhookJobData): Promise<void> {
  const { webhookEventId, organizationId, integrationId, source, eventType } = data;

  // ── 1. Fetch the event record ──
  const event = await prisma.webhookEvent.findUnique({ where: { id: webhookEventId } });
  if (!event) throw new Error(`WebhookEvent ${webhookEventId} not found`);
  if (event.organizationId !== organizationId) {
    throw new Error("WebhookEvent does not belong to this organization");
  }
  if (event.status === "PROCESSED") {
    console.warn(`[webhook] Event ${webhookEventId} already processed — skipping`);
    return; // idempotent
  }

  // ── 2. Mark as PROCESSING ──
  await prisma.webhookEvent.update({ where: { id: webhookEventId }, data: { status: "PROCESSING" } });

  try {
    await routeEvent({
      source,
      eventType,
      payload: event.payload as Record<string, unknown>,
      organizationId,
      integrationId,
    });

    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { status: "FAILED", error: message },
    });
    throw err; // Inngest retry
  }
}

// ---------------------------------------------------------------------------
interface EventContext {
  source: string;
  eventType: string;
  payload: Record<string, unknown>;
  organizationId: string;
  integrationId: string;
}

async function routeEvent(ctx: EventContext): Promise<void> {
  switch (ctx.source.toLowerCase()) {
    case "zoho":
      return processZohoWebhook(ctx);
    default:
      console.warn(`[webhook] Unknown webhook source: ${ctx.source}`);
  }
}

async function processZohoWebhook(ctx: EventContext): Promise<void> {
  const { eventType, organizationId, integrationId } = ctx;

  const [module, action] = eventType.split(".").map((s) => s.toLowerCase());
  if (!module || !action) {
    console.warn(`[webhook] Unrecognized Zoho event type: ${eventType}`);
    return;
  }

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
    console.info(`[webhook] No handler for Zoho module: ${module}`);
    return;
  }

  if (["create", "edit", "delete", "update"].includes(action)) {
    const syncJobId = `wh-sync-${organizationId}-${Date.now()}`;

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

    await enqueueSync(
      {
        syncJobId: syncJob.id,
        organizationId,
        integrationId,
        connectorType: "ZOHO",
        entity,
        isIncremental: true,
      },
      1000 // small delay to batch rapid webhook bursts
    );

    console.info(`[webhook] Triggered incremental sync for ${entity} via Zoho ${eventType}`);
  }
}
