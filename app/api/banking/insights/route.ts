import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const insights = await prisma.bankAIInsight.findMany({
    where: { organizationId: orgId, isDismissed: false },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ insights });
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { id, action } = await req.json();
  if (!id || !action) return NextResponse.json({ error: "id and action required" }, { status: 400 });

  const data = action === "dismiss" ? { isDismissed: true } : { isRead: true };

  const insight = await prisma.bankAIInsight.updateMany({
    where: { id, organizationId: orgId },
    data,
  });

  return NextResponse.json({ updated: insight.count });
}
