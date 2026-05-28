// ============================================================
// GET    /api/integrations/[id]   — Get single integration
// PATCH  /api/integrations/[id]   — Update config/settings
// DELETE /api/integrations/[id]   — Soft delete
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  syncIntervalMins: z.int().min(5).max(10080).optional(),
});

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();

  const integration = await (prisma as any).integration.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
    include: {
      oauthToken: { select: { expiresAt: true, scope: true, grantedScopes: true } },
      syncJobs: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true, status: true, type: true, entity: true,
          startedAt: true, completedAt: true,
          totalRecords: true, successRecords: true, failedRecords: true,
        },
      },
    },
  });

  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  return NextResponse.json(integration);
}

// ---------------------------------------------------------------------------
// PATCH
// ---------------------------------------------------------------------------
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();

  const existing = await (prisma as any).integration.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
  });

  if (!existing) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const updated = await (prisma as any).integration.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.config !== undefined && { config: parsed.data.config as Prisma.InputJsonValue }),
      ...(parsed.data.syncIntervalMins !== undefined && {
        syncIntervalMins: parsed.data.syncIntervalMins,
      }),
    },
  });

  return NextResponse.json(updated);
}

// ---------------------------------------------------------------------------
// DELETE — soft delete
// ---------------------------------------------------------------------------
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();

  const existing = await (prisma as any).integration.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
  });

  if (!existing) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  await (prisma as any).integration.update({
    where: { id },
    data: { deletedAt: new Date(), status: "INACTIVE" },
  });

  return NextResponse.json({ success: true });
}
