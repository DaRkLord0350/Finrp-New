// ============================================================
// GET  /api/integrations   — List all integrations for org
// POST /api/integrations   — Create a new integration record
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { ConnectorType, Prisma } from "@prisma/client";

const createIntegrationSchema = z.object({
  type: z.enum(["ZOHO_CRM", "ZOHO_BOOKS", "ZOHO_INVENTORY", "TALLY", "ODOO", "CSV", "EXCEL"]),
  name: z.string().min(1).max(100),
  config: z.record(z.string(), z.unknown()).optional(),
  syncIntervalMins: z.int().min(5).max(10080).optional(),
});

// ---------------------------------------------------------------------------
// GET — list integrations
// ---------------------------------------------------------------------------
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();

  const integrations = await (prisma as any).integration.findMany({
    where: { organizationId: user.organizationId, deletedAt: null },
    include: {
      oauthToken: {
        select: { expiresAt: true, scope: true, grantedScopes: true },
      },
      _count: {
        select: { syncJobs: true, importJobs: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(integrations);
}

// ---------------------------------------------------------------------------
// POST — create integration
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();

  const body = await request.json();
  const parsed = createIntegrationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { type, name, config, syncIntervalMins } = parsed.data;

  // Enforce unique constraint: one integration per type per org
  const existing = await (prisma as any).integration.findFirst({
    where: {
      organizationId: user.organizationId,
      type: type as ConnectorType,
      deletedAt: null,
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: `An integration of type ${type} already exists for this organization` },
      { status: 409 }
    );
  }

  const integration = await (prisma as any).integration.create({
    data: {
      organizationId: user.organizationId,
      type: type as ConnectorType,
      name,
      status: "INACTIVE",
      config: (config ?? {}) as Prisma.InputJsonValue,
      syncIntervalMins: syncIntervalMins ?? 60,
    },
  });

  return NextResponse.json(integration, { status: 201 });
}
