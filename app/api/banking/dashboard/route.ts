import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") ?? "this_month";

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [accounts, transactions, reconSessions, riskAlerts, insights, vendors, payments, succeededThisMonth] = await Promise.all([
      prisma.bankAccount.findMany({
        where: { organizationId: orgId, isActive: true, deletedAt: null },
        select: { id: true, bankName: true, currentBalance: true, availableBalance: true, ledgerBalance: true, lastSyncAt: true, healthScore: true },
      }),
      prisma.bankTransaction.findMany({
        where: { organizationId: orgId, transactionDate: { gte: startOfMonth, lte: endOfMonth } },
        select: { id: true, credit: true, debit: true, reconcileStatus: true, status: true },
      }),
      prisma.bankReconciliationSession.findFirst({
        where: { organizationId: orgId, status: "IN_PROGRESS" },
        select: { totalTxns: true, matchedTxns: true, unmatchedTxns: true },
      }),
      prisma.bankRiskAlert.count({
        where: { organizationId: orgId, status: "OPEN" },
      }),
      prisma.bankAIInsight.findMany({
        where: { organizationId: orgId, isDismissed: false, isRead: false },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, insightType: true, title: true, summary: true, severity: true, createdAt: true },
      }),
      // Beneficiaries — dashboard section (Vendor is the source of truth)
      prisma.vendor.groupBy({
        by: ["tbxBeneficiaryStatus"],
        where: { organizationId: orgId, deletedAt: null, tbxBeneficiaryId: { not: null } },
        _count: { _all: true },
      }),
      // Payments / Payment Status / Scheduled / Bulk — dashboard sections
      prisma.vendorPayment.groupBy({
        by: ["status"],
        where: { organizationId: orgId, deletedAt: null },
        _count: { _all: true },
      }),
      prisma.vendorPayment.aggregate({
        where: { organizationId: orgId, deletedAt: null, status: "SUCCESS", processedAt: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    const [scheduledPayments, bulkPayments, recentPayments] = await Promise.all([
      prisma.vendorPayment.count({
        where: { organizationId: orgId, deletedAt: null, paymentType: "SCHEDULED", status: { notIn: ["SUCCESS", "FAILED", "CANCELLED"] } },
      }),
      prisma.vendorPayment.count({
        where: { organizationId: orgId, deletedAt: null, paymentType: "BULK", status: { notIn: ["SUCCESS", "FAILED", "CANCELLED"] } },
      }),
      prisma.vendorPayment.findMany({
        where: { organizationId: orgId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          amount: true,
          paymentType: true,
          status: true,
          createdAt: true,
          purchase: { select: { purchaseNumber: true, vendorName: true, vendor: { select: { name: true } } } },
        },
      }),
    ]);

    const totalBalance = accounts.reduce((s, a) => s + Number(a.currentBalance), 0);
    const availableBalance = accounts.reduce((s, a) => s + Number(a.availableBalance), 0);
    const ledgerBalance = accounts.reduce((s, a) => s + Number(a.ledgerBalance), 0);
    const lastUpdated = accounts.reduce<Date | null>((latest, a) => {
      if (!a.lastSyncAt) return latest;
      return !latest || a.lastSyncAt > latest ? a.lastSyncAt : latest;
    }, null);
    const monthlyInflow = transactions.reduce((s, t) => s + (t.credit ? Number(t.credit) : 0), 0);
    const monthlyOutflow = transactions.reduce((s, t) => s + (t.debit ? Number(t.debit) : 0), 0);
    const unmatchedTxns = transactions.filter(t => t.reconcileStatus === "UNMATCHED").length;

    const beneficiaryCounts = Object.fromEntries(vendors.map((v) => [v.tbxBeneficiaryStatus, v._count._all]));
    const paymentCounts = Object.fromEntries(payments.map((p) => [p.status, p._count._all]));

    return NextResponse.json({
      kpis: {
        totalBalance,
        availableBalance,
        ledgerBalance,
        lastUpdated,
        monthlyInflow,
        monthlyOutflow,
        netCashFlow: monthlyInflow - monthlyOutflow,
        pendingReconciliation: reconSessions?.unmatchedTxns ?? unmatchedTxns,
        unmatchedTxns,
        connectedAccounts: accounts.length,
        openRiskAlerts: riskAlerts,
      },
      accounts: accounts.slice(0, 6),
      insights,
      reconProgress: reconSessions ?? { totalTxns: transactions.length, matchedTxns: transactions.filter(t => t.reconcileStatus === "MATCHED").length, unmatchedTxns },
      beneficiaries: {
        active: beneficiaryCounts.ACTIVE ?? 0,
        pending: beneficiaryCounts.PENDING ?? 0,
        failed: beneficiaryCounts.FAILED ?? 0,
        inactive: beneficiaryCounts.INACTIVE ?? 0,
        total: vendors.reduce((s, v) => s + v._count._all, 0),
      },
      payments: {
        checkerPending: paymentCounts.CHECKER_PENDING ?? 0,
        inFlight: (paymentCounts.SUBMITTED ?? 0) + (paymentCounts.PROCESSING ?? 0),
        succeeded: paymentCounts.SUCCESS ?? 0,
        failed: paymentCounts.FAILED ?? 0,
        settledThisMonth: Number(succeededThisMonth._sum.amount ?? 0),
        settledCountThisMonth: succeededThisMonth._count._all,
        scheduled: scheduledPayments,
        bulk: bulkPayments,
        recent: recentPayments,
      },
    });
  } catch (err) {
    console.error("[banking/dashboard]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
