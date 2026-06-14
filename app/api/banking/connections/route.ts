import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const connections = await prisma.bankConnection.findMany({
    where: { organizationId: orgId },
    include: { _count: { select: { bankAccounts: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ connections });
}
