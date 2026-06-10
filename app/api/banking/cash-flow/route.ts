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
  const period = searchParams.get("period") ?? "MONTHLY";
  const months = Number(searchParams.get("months") ?? 6);

  const snapshots = await prisma.cashFlowSnapshot.findMany({
    where: { organizationId: orgId, period },
    orderBy: { snapshotDate: "asc" },
    take: months,
  });

  // Aggregate from transactions if no snapshots
  if (snapshots.length === 0) {
    const now = new Date();
    const data = await Promise.all(
      Array.from({ length: months }, async (_, i) => {
        const month = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
        const nextMonth = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i) + 1, 1);
        const txns = await prisma.bankTransaction.aggregate({
          where: { organizationId: orgId, transactionDate: { gte: month, lt: nextMonth } },
          _sum: { credit: true, debit: true },
        });
        const inflow = Number(txns._sum.credit ?? 0);
        const outflow = Number(txns._sum.debit ?? 0);
        return {
          month: month.toLocaleString("default", { month: "short", year: "2-digit" }),
          inflow,
          outflow,
          net: inflow - outflow,
          snapshotDate: month,
        };
      })
    );
    return NextResponse.json({ snapshots: data, source: "computed" });
  }

  return NextResponse.json({ snapshots, source: "cached" });
}
