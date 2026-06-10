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

    const [accounts, transactions, reconSessions, riskAlerts, insights] = await Promise.all([
      prisma.bankAccount.findMany({
        where: { organizationId: orgId, isActive: true, deletedAt: null },
        select: { id: true, bankName: true, currentBalance: true, availableBalance: true, lastSyncAt: true, healthScore: true, consentStatus: true },
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
    ]);

    const totalBalance = accounts.reduce((s, a) => s + Number(a.currentBalance), 0);
    const availableBalance = accounts.reduce((s, a) => s + Number(a.availableBalance), 0);
    const monthlyInflow = transactions.reduce((s, t) => s + (t.credit ? Number(t.credit) : 0), 0);
    const monthlyOutflow = transactions.reduce((s, t) => s + (t.debit ? Number(t.debit) : 0), 0);
    const unmatchedTxns = transactions.filter(t => t.reconcileStatus === "UNMATCHED").length;

    return NextResponse.json({
      kpis: {
        totalBalance,
        availableBalance,
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
    });
  } catch (err) {
    console.error("[banking/dashboard]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
