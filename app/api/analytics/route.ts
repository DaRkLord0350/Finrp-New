// ============================================================
// GET /api/analytics
// Aggregated analytics via SQL — never loads full invoice rows.
// Safe at 500k+ customers per org.
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { withCache, CacheKey, TTL } from "@/lib/cache";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await withCache(
      CacheKey.analytics(tenantId, "summary"),
      TTL.ANALYTICS,
      () => computeAnalytics(tenantId)
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error("[ANALYTICS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function computeAnalytics(tenantId: string) {
  const now = new Date();
  const sevenMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

  const [
    revenueAgg,
    countsByStatus,
    customerCount,
    topCustomerRows,
    monthlyRows,
  ] = await Promise.allSettled([
    prisma.invoice.aggregate({
      where: { organizationId: tenantId, status: "PAID" },
      _sum: { total: true },
      _count: { id: true },
    }),
    prisma.invoice.groupBy({
      by: ["status"],
      where: { organizationId: tenantId },
      _count: { id: true },
    }),
    prisma.customer.count({ where: { organizationId: tenantId } }),

    // Top 5 customers by paid revenue
    prisma.$queryRaw<{ id: string; name: string; total_revenue: string }[]>`
      SELECT
        c.id,
        c.name,
        COALESCE(SUM(i.total), 0)::text AS total_revenue
      FROM customers c
      LEFT JOIN invoices i
        ON  i."customerId"     = c.id
        AND i.status           = 'PAID'
        AND i."organizationId" = ${tenantId}
      WHERE c."organizationId" = ${tenantId}
      GROUP BY c.id, c.name
      ORDER BY SUM(i.total) DESC NULLS LAST
      LIMIT 5
    `,

    // Monthly revenue breakdown
    prisma.$queryRaw<{
      year_num: number;
      month_num: number;
      month_label: string;
      revenue: string;
      invoice_count: bigint;
    }[]>`
      SELECT
        EXTRACT(YEAR  FROM "issueDate")::int    AS year_num,
        EXTRACT(MONTH FROM "issueDate")::int    AS month_num,
        TO_CHAR("issueDate", 'Mon')             AS month_label,
        COALESCE(SUM(total), 0)::text           AS revenue,
        COUNT(*)                                AS invoice_count
      FROM invoices
      WHERE "organizationId" = ${tenantId}
        AND status           = 'PAID'
        AND "issueDate"      >= ${sevenMonthsAgo}
      GROUP BY
        EXTRACT(YEAR  FROM "issueDate"),
        EXTRACT(MONTH FROM "issueDate"),
        TO_CHAR("issueDate", 'Mon')
      ORDER BY
        EXTRACT(YEAR  FROM "issueDate"),
        EXTRACT(MONTH FROM "issueDate")
    `,
  ]);

  const rev          = revenueAgg.status === "fulfilled" ? revenueAgg.value : null;
  const statusGroups = countsByStatus.status === "fulfilled" ? countsByStatus.value : [];
  const customers    = customerCount.status === "fulfilled" ? customerCount.value : 0;
  const topRows      = topCustomerRows.status === "fulfilled" ? topCustomerRows.value : [];
  const months       = monthlyRows.status === "fulfilled" ? monthlyRows.value : [];

  const totalRevenue = Number(rev?._sum?.total ?? 0);
  const paidCount    = statusGroups.find((g) => g.status === "PAID")?._count?.id    ?? 0;
  const overdueCount = statusGroups.find((g) => g.status === "OVERDUE")?._count?.id ?? 0;
  const sentCount    = statusGroups.find((g) => g.status === "SENT")?._count?.id    ?? 0;
  const draftCount   = statusGroups.find((g) => g.status === "DRAFT")?._count?.id   ?? 0;
  const totalInvoices = statusGroups.reduce((s, g) => s + (g._count?.id ?? 0), 0);
  const avgDealSize  = paidCount > 0 ? totalRevenue / paidCount : 0;

  const monthlyRevenue = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (6 - idx), 1);
    const row = months.find(
      (r) => r.year_num === d.getFullYear() && r.month_num === d.getMonth() + 1
    );
    return {
      month:    d.toLocaleString("en-US", { month: "short" }),
      revenue:  Number(row?.revenue ?? 0),
      invoices: Number(row?.invoice_count ?? 0),
    };
  });

  const currentMonthRev = monthlyRevenue[6]?.revenue ?? 0;
  const prevMonthRev    = monthlyRevenue[5]?.revenue ?? 0;
  const revenueGrowth   = prevMonthRev > 0
    ? Math.round(((currentMonthRev - prevMonthRev) / prevMonthRev) * 1000) / 10
    : 0;

  const total = totalInvoices || 1;
  const paymentMix = [
    { name: "Paid",        value: Math.round((paidCount    / total) * 100), color: "#10b981" },
    { name: "Outstanding", value: Math.round((sentCount    / total) * 100), color: "#3b82f6" },
    { name: "Overdue",     value: Math.round((overdueCount / total) * 100), color: "#ef4444" },
    { name: "Draft",       value: Math.round((draftCount   / total) * 100), color: "#52525b" },
  ];

  const topCustomers = topRows.map((r) => ({
    name:    r.name,
    revenue: Number(r.total_revenue),
  }));

  return {
    totalRevenue,
    revenueGrowth,
    totalInvoices,
    paidInvoices:   paidCount,
    overdueInvoices: overdueCount,
    totalCustomers: customers,
    avgDealSize:    Math.round(avgDealSize),
    monthlyRevenue,
    paymentMix,
    topCustomers,
  };
}
