// ============================================================
// POST /api/webhooks/zoho — Receive inbound Zoho webhook events
// Verifies HMAC signature, stores WebhookEvent, enqueues worker.
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueWebhook } from "@/lib/jobs/queues";
import { createHmac, timingSafeEqual } from "crypto";

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

function verifyZohoSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  try {
    const hmac = createHmac("sha256", secret);
    hmac.update(rawBody, "utf8");
    const computed = hmac.digest("hex");

    // Timing-safe comparison
    const computedBuf = Buffer.from(computed, "hex");
    const signatureBuf = Buffer.from(signature.replace("sha256=", ""), "hex");

    if (computedBuf.length !== signatureBuf.length) return false;
    return timingSafeEqual(computedBuf, signatureBuf);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-zoho-webhook-signature") ?? "";
  const zohoToken = request.headers.get("x-zoho-webhook-token") ?? "";

  // ── 1. Find integration by webhook token ──
  const integration = await prisma.integration.findFirst({
    where: {
      type: { in: ["ZOHO_CRM", "ZOHO_BOOKS", "ZOHO_INVENTORY"] },
      config: {
        path: ["webhookToken"],
        equals: zohoToken,
      },
    },
    select: { id: true, organizationId: true, config: true },
  });

  if (!integration) {
    // Return 200 to prevent Zoho from retrying (token not ours)
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // ── 2. Verify HMAC signature if secret is configured ──
  const config = integration.config as { webhookSecret?: string } | null;
  if (config?.webhookSecret && signature) {
    const isValid = verifyZohoSignature(rawBody, signature, config.webhookSecret);
    if (!isValid) {
      console.warn("[ZohoWebhook] Invalid signature for integration", integration.id);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  // ── 3. Parse payload ──
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const eventType = (
    payload["event_type"] ??
    payload["module"] ??
    "unknown"
  ) as string;

  const externalId = (payload["id"] ?? payload["event_id"]) as string | undefined;

  // ── 4. Idempotency check — skip duplicate events ──
  if (externalId) {
    const exists = await prisma.webhookEvent.findFirst({
      where: {
        organizationId: integration.organizationId,
        externalId,
        status: { in: ["PROCESSED", "PROCESSING"] },
      },
    });
    if (exists) {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }
  }

  // ── 5. Store WebhookEvent ──
  const event = await prisma.webhookEvent.create({
    data: {
      organizationId: integration.organizationId,
      integrationId: integration.id,
      source: "ZOHO_CRM",
      eventType,
      externalId: externalId ?? null,
      payload: payload as Parameters<typeof prisma.webhookEvent.create>[0]["data"]["payload"],
      rawPayload: rawBody,
      signature: signature || null,
      status: "PENDING",
    },
  });

  // ── 6. Enqueue webhook processor ──
  const jobId = await enqueueWebhook({
    webhookEventId: event.id,
    organizationId: integration.organizationId,
    integrationId: integration.id,
    source: "ZOHO",
    eventType,
  });

  await prisma.webhookEvent.update({
    where: { id: event.id },
    data: { bullmqJobId: jobId },
  });

  // Always respond 200 quickly so Zoho doesn't retry
  return NextResponse.json({ received: true, eventId: event.id }, { status: 200 });
}
