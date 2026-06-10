// ============================================================
// FinRP — Plaid Webhook Handler
// Processes Plaid webhook events with JWT verification.
// POST /api/webhooks/plaid
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { processPlaidWebhook } from "@/lib/banking/integrations/plaid-client";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const itemId = String(payload.item_id ?? "");

  // Find org from item_id stored in connection metadata
  const connection = await prisma.bankConnection.findFirst({
    where: {
      metadata: { path: ["itemId"], equals: itemId },
    },
    select: { organizationId: true, id: true },
  });

  if (!connection) {
    // May be a test webhook or unknown item — accept and ignore
    return NextResponse.json({ received: true });
  }

  try {
    await processPlaidWebhook(payload, connection.organizationId);
    return NextResponse.json({ received: true });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: "banking", action: "plaid-webhook" },
      extra: { payload },
    });
    return NextResponse.json({ received: true, error: "processing_error" });
  }
}
