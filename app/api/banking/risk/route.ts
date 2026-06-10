import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const severity = searchParams.get("severity");

  const where: Record<string, unknown> = { organizationId: orgId };
  if (status) where.status = status;
  if (severity) where.severity = severity;

  const [alerts, stats] = await Promise.all([
    prisma.bankRiskAlert.findMany({
      where,
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 50,
      include: { transaction: { select: { narration: true, transactionDate: true, credit: true, debit: true } } },
    }),
    prisma.bankRiskAlert.groupBy({
      by: ["severity"],
      where: { organizationId: orgId, status: "OPEN" },
      _count: { id: true },
    }),
  ]);

  return NextResponse.json({ alerts, stats });
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { id, status } = await req.json();
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });

  const alert = await prisma.bankRiskAlert.updateMany({
    where: { id, organizationId: orgId },
    data: { status, resolvedAt: status === "RESOLVED" ? new Date() : null },
  });

  return NextResponse.json({ updated: alert.count });
}
