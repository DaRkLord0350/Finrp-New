import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.read" });

    const npaStatuses = ["NPA_SUBSTANDARD", "NPA_DOUBTFUL", "NPA_LOSS"] as const;

    // Independent reads — Promise.all rather than $transaction (no
    // cross-query atomicity is needed for a dashboard snapshot, and it
    // sidesteps a TS inference issue with heterogeneous groupBy/aggregate
    // calls inside $transaction's array overload).
    const [applicationsByStatus, accountsByStatus, portfolioAgg, npaAgg, disbursedThisMonthAgg, collectionsByBucket] =
      await Promise.all([
        prisma.loanApplication.groupBy({ by: ["status"], where: { organizationId, deletedAt: null }, _count: { _all: true } }),
        prisma.loanAccount.groupBy({ by: ["status"], where: { organizationId }, _count: { _all: true }, _sum: { currentOutstandingPrincipal: true } }),
        prisma.loanAccount.aggregate({
          where: { organizationId, status: { in: ["ACTIVE", ...npaStatuses] } },
          _sum: { currentOutstandingPrincipal: true, principalDisbursed: true },
          _count: { _all: true },
        }),
        prisma.loanAccount.aggregate({
          where: { organizationId, status: { in: [...npaStatuses] } },
          _sum: { currentOutstandingPrincipal: true },
          _count: { _all: true },
        }),
        prisma.loanDisbursement.aggregate({
          where: { organizationId, status: "COMPLETED", disbursedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.loanCollectionCase.groupBy({
          by: ["bucket"],
          where: { organizationId, status: { in: ["OPEN", "IN_PROGRESS", "PROMISE_TO_PAY", "ESCALATED"] } },
          _count: { _all: true },
          _sum: { overdueAmount: true },
        }),
      ]);

    const totalOutstanding = Number(portfolioAgg._sum.currentOutstandingPrincipal ?? 0);
    const npaOutstanding = Number(npaAgg._sum.currentOutstandingPrincipal ?? 0);

    return NextResponse.json({
      applicationsByStatus: applicationsByStatus.map((s) => ({ status: s.status, count: s._count._all })),
      accountsByStatus: accountsByStatus.map((s) => ({
        status: s.status,
        count: s._count._all,
        outstanding: s._sum.currentOutstandingPrincipal?.toString() ?? "0",
      })),
      portfolio: {
        activeAccounts: portfolioAgg._count._all,
        totalOutstanding: totalOutstanding.toFixed(2),
        totalDisbursedEver: (portfolioAgg._sum.principalDisbursed ?? 0).toString(),
      },
      npa: {
        count: npaAgg._count._all,
        outstanding: npaOutstanding.toFixed(2),
        percentOfPortfolio: totalOutstanding > 0 ? ((npaOutstanding / totalOutstanding) * 100).toFixed(2) : "0.00",
      },
      disbursedThisMonth: {
        count: disbursedThisMonthAgg._count._all,
        amount: (disbursedThisMonthAgg._sum.amount ?? 0).toString(),
      },
      collectionsByBucket: collectionsByBucket.map((b) => ({
        bucket: b.bucket,
        count: b._count._all,
        overdueAmount: b._sum.overdueAmount?.toString() ?? "0",
      })),
    });
  } catch (err) {
    return mapLendingError(err, "LENDING_PORTFOLIO_STATS");
  }
}
