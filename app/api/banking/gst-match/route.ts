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
  const period = searchParams.get("period");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { organizationId: orgId };
  if (period) where.gstrPeriod = period;
  if (status) where.matchStatus = status;

  const matches = await prisma.gSTBankMatch.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const stats = {
    total: matches.length,
    matched: matches.filter(m => m.matchStatus === "MATCHED").length,
    partial: matches.filter(m => m.matchStatus === "PARTIAL").length,
    issues: matches.filter(m => !["MATCHED"].includes(m.matchStatus)).length,
    missingITC: matches
      .filter(m => m.matchStatus === "MISSING_INVOICE")
      .reduce((s, m) => s + Number(m.gstAmount ?? 0), 0),
  };

  return NextResponse.json({ matches, stats });
}
