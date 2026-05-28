// ============================================================
// POST /api/integrations/[id]/sync — Trigger manual sync
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { enqueueSync } from "@/lib/jobs/queues";
import { z } from "zod";

const triggerSyncSchema = z.object({
  entity: z.enum(["customers", "invoices", "products", "employees", "all"]).optional(),
  isIncremental: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();

  const integration = await (prisma as any).integration.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
  });

  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  if (integration.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Integration is not active. Connect it first." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = triggerSyncSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const entity = parsed.data.entity ?? "all";
  const isIncremental = parsed.data.isIncremental ?? true;

  // Create SyncJob record
  const syncJob = await (prisma as any).syncJob.create({
    data: {
      organizationId: user.organizationId,
      integrationId: id,
      type: isIncremental ? "INCREMENTAL" : "FULL",
      entity,
      status: "QUEUED",
      triggeredBy: userId,
      scheduledAt: new Date(),
    },
  });

  // Enqueue in BullMQ
  const jobId = await enqueueSync({
    syncJobId: syncJob.id,
    organizationId: user.organizationId,
    integrationId: id,
    connectorType: integration.type,
    entity,
    isIncremental,
  });

  await (prisma as any).syncJob.update({
    where: { id: syncJob.id },
    data: { bullmqJobId: jobId },
  });

  return NextResponse.json({
    syncJobId: syncJob.id,
    bullmqJobId: jobId,
    entity,
    isIncremental,
    status: "QUEUED",
  }, { status: 202 });
}
