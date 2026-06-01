import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { subMonths, format, startOfMonth, endOfMonth } from "date-fns";

export async function GET() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const integration = await prisma.tredsIntegration.findUnique({
      where: { organizationId: tenantId },
      select: { id: true, status: true, lastSyncAt: true, provider: true },
    });

    if (!integration) {
      return NextResponse.json({
        stats: { totalEligible: 0, submitted: 0, discounted: 0, pendingApproval: 0, fundsReceived: 0, avgFinancingRate: 0 },
        monthlyFunding: [],
        fundingByFinancier: [],
        recentInvoices: [],
        aiInsights: [],
        integration: null,
      });
    }

    const invoices = await prisma.tredsInvoice.findMany({
      where: { organizationId: tenantId },
      orderBy: { createdAt: "desc" },
    });

    const totalEligible = invoices.filter(
      (i) => i.status === "READY" || i.status === "DRAFT"
    ).length;
    const submitted = invoices.filter((i) =>
      ["SUBMITTED", "BUYER_APPROVED", "UNDER_BIDDING", "DISCOUNTED", "SETTLED"].includes(i.status)
    ).length;
    const discounted = invoices.filter((i) => i.status === "DISCOUNTED" || i.status === "SETTLED").length;
    const pendingApproval = invoices.filter((i) =>
      i.status === "SUBMITTED" || i.status === "UNDER_BIDDING"
    ).length;

    const fundedInvoices = invoices.filter((i) => i.fundingAmount !== null);
    const fundsReceived = fundedInvoices.reduce(
      (s, i) => s + Number(i.fundingAmount ?? 0),
      0
    );
    const rates = invoices.filter((i) => i.financingRate !== null).map((i) => Number(i.financingRate));
    const avgFinancingRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;

    // Monthly funding trend (last 6 months)
    const now = new Date();
    const monthlyFunding = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i);
      const label = format(d, "MMM");
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const monthInvoices = invoices.filter((inv) => {
        const c = new Date(inv.createdAt);
        return c >= start && c <= end;
      });
      return {
        month: label,
        submitted: monthInvoices.filter((inv) => inv.submittedAt).length,
        approved: monthInvoices.filter((inv) => inv.approvedAt).length,
        funded: monthInvoices.filter((inv) => inv.fundedAt).length,
      };
    });

    // Funding by financier
    const financierMap = new Map<string, number>();
    for (const inv of fundedInvoices) {
      if (!inv.financierName) continue;
      financierMap.set(inv.financierName, (financierMap.get(inv.financierName) ?? 0) + Number(inv.fundingAmount ?? 0));
    }
    const fundingByFinancier = Array.from(financierMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);

    // Recent invoices (last 10)
    const recentInvoices = invoices.slice(0, 10).map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      buyerName: i.buyerName,
      invoiceAmount: Number(i.invoiceAmount),
      dueDate: i.dueDate.toISOString(),
      status: i.status,
      financierName: i.financierName,
      financingRate: i.financingRate !== null ? Number(i.financingRate) : null,
      fundingAmount: i.fundingAmount !== null ? Number(i.fundingAmount) : null,
    }));

    // AI Insights — derived from real data
    const aiInsights = [];

    const nearDue = invoices.filter((i) => {
      if (i.status !== "READY" && i.status !== "DRAFT") return false;
      const daysLeft = Math.ceil((new Date(i.dueDate).getTime() - Date.now()) / 86400000);
      return daysLeft > 0 && daysLeft <= 15;
    });
    if (nearDue.length > 0) {
      aiInsights.push({
        title: `${nearDue.length} invoice${nearDue.length > 1 ? "s" : ""} nearing due date`,
        description: "Submit eligible invoices to TReDS before they lose discounting window.",
        type: "warning" as const,
      });
    }

    if (avgFinancingRate > 0) {
      const bestRate = rates.reduce((a, b) => Math.min(a, b), Infinity);
      aiInsights.push({
        title: `Best financing rate secured: ${bestRate.toFixed(2)}% p.a.`,
        description: `Your average rate is ${avgFinancingRate.toFixed(2)}%. More bids can improve this further.`,
        type: "info" as const,
      });
    }

    if (totalEligible > 0) {
      aiInsights.push({
        title: `${totalEligible} eligible invoice${totalEligible > 1 ? "s" : ""} ready for discounting`,
        description: "Submit now to unlock early liquidity at competitive rates.",
        type: "opportunity" as const,
      });
    }

    if (discounted > 0 && fundsReceived > 0) {
      aiInsights.push({
        title: `₹${(fundsReceived / 100000).toFixed(1)}L in working capital unlocked`,
        description: "TReDS discounting is improving your cash flow effectively.",
        type: "info" as const,
      });
    }

    return NextResponse.json({
      stats: {
        totalEligible,
        submitted,
        discounted,
        pendingApproval,
        fundsReceived,
        avgFinancingRate: Math.round(avgFinancingRate * 100) / 100,
      },
      monthlyFunding,
      fundingByFinancier,
      recentInvoices,
      aiInsights: aiInsights.slice(0, 4),
      integration: {
        status: integration.status,
        lastSyncAt: integration.lastSyncAt?.toISOString() ?? null,
        provider: integration.provider,
      },
    });
  } catch (error) {
    console.error("[TREDS_DASHBOARD]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
