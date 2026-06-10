import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const rules = await prisma.bankingRule.findMany({
    where: { organizationId: orgId },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const body = await req.json();
  const { name, description, priority, conditions, actions, isActive } = body;

  if (!name || !conditions || !actions) {
    return NextResponse.json({ error: "name, conditions, actions required" }, { status: 400 });
  }

  const rule = await prisma.bankingRule.create({
    data: {
      organizationId: orgId,
      name,
      description: description ?? null,
      priority: priority ?? 100,
      conditions,
      actions,
      isActive: isActive ?? true,
    },
  });

  return NextResponse.json({ rule }, { status: 201 });
}
