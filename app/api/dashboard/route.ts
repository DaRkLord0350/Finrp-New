// ============================================================
// GET /api/dashboard
// Aggregated dashboard stats — uses SQL aggregates (not JS
// in-memory) so it stays fast even with 100k+ invoices.
// Results are cached in Redis for 60 seconds.
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { withCache, cacheDel, CacheKey, TTL } from "@/lib/cache";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = await getTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await withCache(
      CacheKey.dashboard(tenantId),
      TTL.DASHBOARD,
      () => computeDashboard(tenantId)
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error("[GET /api/dashboard]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Invalidate the dashboard cache when data changes (call from mutations)
// ---------------------------------------------------------------------------
export async function invalidateDashboardCache(orgId: string) {
  await cacheDel(CacheKey.dashboard(orgId));
}

// ---------------------------------------------------------------------------
// Safe unwrap for Promise.allSettled results.
// Logs the failure but returns the fallback so the dashboard never crashes.
// ---------------------------------------------------------------------------
function unwrap<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
  label: string
): T {
  if (result.status === "fulfilled") return result.value;
  console.error(`[dashboard] ${label} failed:`, (result.reason as Error)?.message ?? result.reason);
  return fallback;
}

// ---------------------------------------------------------------------------
// Core computation — all queries run with Promise.allSettled so a single
// DB hiccup degrades one metric instead of crashing the entire dashboard.
// Uses SQL aggregates (not JS iteration) — safe at 100k+ rows.
// ---------------------------------------------------------------------------
async function computeDashboard(tenantId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  // 7 months back (inclusive of current)
  const sevenMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

  const [
    totalRevenueRes,
    overdueCountRes,
    thisMonthCountRes,
    totalInvoiceCountRes,
    customerCountRes,
    complianceTasksRes,
    lowStockItemsRes,
    recentInvoicesRes,
    prevMonthRevenueRes,
    monthlyRowsRes,
  ] = await Promise.allSettled([
    // Total revenue — single aggregate, no row scan in JS
    prisma.invoice.aggregate({
      where: { organizationId: tenantId, status: "PAID" },
      _sum: { total: true },
    }),

    // Overdue count
    prisma.invoice.count({
      where: { organizationId: tenantId, status: "OVERDUE" },
    }),

    // This month's invoice count
    prisma.invoice.count({
      where: {
        organizationId: tenantId,
        issueDate: { gte: startOfMonth },
      },
    }),

    // Total invoice count
    prisma.invoice.count({
      where: { organizationId: tenantId },
    }),

    // Customer count
    prisma.customer.count({
      where: { organizationId: tenantId },
    }),

    // Upcoming compliance tasks — already small/indexed
    prisma.complianceTask.findMany({
      where: {
        organizationId: tenantId,
        status: { not: "COMPLETED" },
      },
      orderBy: { dueDate: "asc" },
      take: 3,
      select: { id: true, title: true, dueDate: true, status: true },
    }),

    // Low-stock items — only select what the UI needs
    prisma.item.findMany({
      where: { organizationId: tenantId },
      orderBy: { stock: "asc" },
      take: 20,
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        reorderLevel: true,
        lowStockAt: true,
      },
    }),

    // 5 most recent invoices
    prisma.invoice.findMany({
      where: { organizationId: tenantId },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),

    // Previous month revenue for growth calculation
    prisma.invoice.aggregate({
      where: {
        organizationId: tenantId,
        status: "PAID",
        issueDate: {
          gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          lt: startOfMonth,
        },
      },
      _sum: { total: true },
    }),

    // Monthly revenue — raw SQL GROUP BY month avoids fetching all rows
    prisma.$queryRaw<
      Array<{
        month_label: string;
        year_num: number;
        month_num: number;
        revenue: string;
        invoice_count: bigint;
      }>
    >`
      SELECT
        TO_CHAR("issueDate", 'Mon')              AS month_label,
        EXTRACT(YEAR FROM "issueDate")::int      AS year_num,
        EXTRACT(MONTH FROM "issueDate")::int     AS month_num,
        COALESCE(SUM("total"), 0)::text          AS revenue,
        COUNT(*)                                 AS invoice_count
      FROM "invoices"
      WHERE "organizationId" = ${tenantId}
        AND "status" = 'PAID'
        AND "issueDate" >= ${sevenMonthsAgo}
      GROUP BY
        EXTRACT(YEAR FROM "issueDate"),
        EXTRACT(MONTH FROM "issueDate"),
        TO_CHAR("issueDate", 'Mon')
      ORDER BY
        EXTRACT(YEAR FROM "issueDate"),
        EXTRACT(MONTH FROM "issueDate")
    `,
  ]);

  // Unwrap each result, falling back to safe zero-values on failure
  const totalRevenueAgg   = unwrap(totalRevenueRes,   { _sum: { total: null } },   "totalRevenue");
  const overdueCount      = unwrap(overdueCountRes,    0,                           "overdueCount");
  const thisMonthCount    = unwrap(thisMonthCountRes,  0,                           "thisMonthCount");
  const totalInvoiceCount = unwrap(totalInvoiceCountRes, 0,                         "totalInvoiceCount");
  const customerCount     = unwrap(customerCountRes,   0,                           "customerCount");
  const complianceTasks   = unwrap(complianceTasksRes, [],                          "complianceTasks");
  const lowStockItems     = unwrap(lowStockItemsRes,   [],                          "lowStockItems");
  const recentInvoices    = unwrap(recentInvoicesRes,  [],                          "recentInvoices");
  const prevMonthRevenueAgg = unwrap(prevMonthRevenueRes, { _sum: { total: null } }, "prevMonthRevenue");
  const monthlyRows       = unwrap(monthlyRowsRes,     [],                          "monthlyRows");
  

  // ── Revenue growth ─────────────────────────────────────────────────────────
  const totalRevenue = Number(totalRevenueAgg._sum.total ?? 0);
  const currentMonthRev = Number(monthlyRows.find((r) => r.month_num === now.getMonth() + 1 && r.year_num === now.getFullYear())?.revenue ?? 0);
  const prevMonthRev = Number(prevMonthRevenueAgg._sum.total ?? 0);
  const revenueGrowth = prevMonthRev > 0
    ? Math.round(((currentMonthRev - prevMonthRev) / prevMonthRev) * 1000) / 10
    : 0;

  // ── Build 7-month chart array (fill gaps with 0) ───────────────────────────
  const monthlyRevenue = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (6 - idx), 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const row = monthlyRows.find((r) => r.year_num === y && r.month_num === m);
    return {
      month: d.toLocaleString("en-US", { month: "short" }),
      revenue: Number(row?.revenue ?? 0),
      invoices: Number(row?.invoice_count ?? 0),
    };
  });

  return {
    stats: {
      totalRevenue,
      revenueGrowth,
      activeCustomers: customerCount,
      invoicesSentThisMonth: thisMonthCount,
      overdueInvoices: overdueCount,
      totalInvoices: totalInvoiceCount,
    },
    monthlyRevenue,
    recentInvoices,
    complianceTasks,
    lowStockItems,
  };
}
