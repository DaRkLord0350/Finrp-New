// ============================================================
// /api/admin/lending — platform-operator cross-tenant Lending view.
// Gated by userRole === "ADMIN" (platform admin), mirrors
// app/api/admin/kyc/route.ts's auth shape exactly — this is NOT
// tenant-scoped like the rest of the Lending API.
// ============================================================

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser().catch(() => null);
    if (!user || user.userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const npaStatuses = ["NPA_SUBSTANDARD", "NPA_DOUBTFUL", "NPA_LOSS"] as const;

    const [
      applicationsByStatus,
      pendingVerificationQueue,
      accountsAgg,
      npaAgg,
      disbursementsByStatus,
      collectionsByBucket,
      recentApplications,
      verificationCasesByStatus,
      verificationChecksByType,
    ] = await Promise.all([
      prisma.loanApplication.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.loanApplication.count({ where: { deletedAt: null, stage: { in: ["DOCUMENT_COLLECTION", "VERIFICATION"] }, status: "IN_PROGRESS" } }),
      prisma.loanAccount.aggregate({ _count: { _all: true }, _sum: { currentOutstandingPrincipal: true, principalDisbursed: true } }),
      prisma.loanAccount.aggregate({ where: { status: { in: [...npaStatuses] } }, _count: { _all: true }, _sum: { currentOutstandingPrincipal: true } }),
      prisma.loanDisbursement.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amount: true } }),
      prisma.loanCollectionCase.groupBy({ by: ["bucket"], where: { status: { in: ["OPEN", "IN_PROGRESS", "PROMISE_TO_PAY", "ESCALATED"] } }, _count: { _all: true } }),
      prisma.loanApplication.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { organization: { select: { name: true } }, customer: { select: { name: true } }, product: { select: { name: true } } },
      }),
      prisma.verificationCase.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.verificationCheck.groupBy({ by: ["checkType"], _count: { _all: true } }),
    ]);

    const totalOutstanding = Number(accountsAgg._sum.currentOutstandingPrincipal ?? 0);
    const npaOutstanding = Number(npaAgg._sum.currentOutstandingPrincipal ?? 0);

    return NextResponse.json({
      applicationsByStatus: applicationsByStatus.map((s) => ({ status: s.status, count: s._count._all })),
      verificationQueueSize: pendingVerificationQueue,
      accounts: {
        total: accountsAgg._count._all,
        totalOutstanding: totalOutstanding.toFixed(2),
        totalDisbursedEver: (accountsAgg._sum.principalDisbursed ?? 0).toString(),
      },
      npa: {
        count: npaAgg._count._all,
        outstanding: npaOutstanding.toFixed(2),
        percentOfPortfolio: totalOutstanding > 0 ? ((npaOutstanding / totalOutstanding) * 100).toFixed(2) : "0.00",
      },
      disbursementsByStatus: disbursementsByStatus.map((d) => ({ status: d.status, count: d._count._all, amount: d._sum.amount?.toString() ?? "0" })),
      collectionsByBucket: collectionsByBucket.map((b) => ({ bucket: b.bucket, count: b._count._all })),
      verificationCasesByStatus: verificationCasesByStatus.map((v) => ({ status: v.status, count: v._count._all })),
      verificationChecksByType: verificationChecksByType.map((v) => ({ checkType: v.checkType, count: v._count._all })),
      recentApplications: recentApplications.map((a) => ({
        id: a.id,
        applicationNumber: a.applicationNumber,
        organizationName: a.organization.name,
        customerName: a.customer.name,
        productName: a.product.name,
        requestedAmount: a.requestedAmount.toString(),
        status: a.status,
        stage: a.stage,
        createdAt: a.createdAt,
      })),
    });
  } catch (err) {
    console.error("[ADMIN_LENDING_GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
