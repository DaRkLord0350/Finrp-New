// ============================================================
// GET /api/dashboard
// Aggregated stats for the dashboard:
//   - Revenue, customers, invoices, overdue count
//   - Low stock items
//   - Recent invoices (last 5)
//   - Upcoming compliance tasks (next 3)
//   - Monthly revenue array (last 7 months)
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use orgId if available, fall back to userId for non-org accounts
    const tenantId = orgId ?? userId;

    const [
      invoices,
      customerCount,
      complianceTasks,
      lowStockItems,
      recentInvoices,
    ] = await Promise.all([
      // All invoices for revenue + overdue calculations
      prisma.invoice.findMany({
        where: { organizationId: tenantId },
        select: { total: true, status: true, issueDate: true },
      }),

      // Customer count
      prisma.customer.count({ where: { organizationId: tenantId } }),

      // Upcoming compliance tasks (not completed, ordered by due date)
      prisma.complianceTask.findMany({
        where: {
          organizationId: tenantId,
          status: { not: "COMPLETED" },
        },
        orderBy: { dueDate: "asc" },
        take: 3,
        select: { id: true, title: true, dueDate: true, status: true },
      }),

      // Items that are at or below low stock threshold
      prisma.item.findMany({
        where: {
          organizationId: tenantId,
        },
        orderBy: { stock: "asc" },
        take: 20,
      }),

      // 5 most recent invoices with customer name
      prisma.invoice.findMany({
        where: { organizationId: tenantId },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    // Revenue stats
    const paidInvoices = invoices.filter((i) => i.status === "PAID");
    const totalRevenue = paidInvoices.reduce(
      (sum, i) => sum + Number(i.total),
      0
    );
    const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;

    // Invoices sent this month
    const now = new Date();
    const thisMonthInvoices = invoices.filter((i) => {
      const d = new Date(i.issueDate);
      return (
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    }).length;

    // Monthly revenue for last 7 months
    const monthlyRevenue = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(now);
      d.setDate(1);
      d.setMonth(d.getMonth() - (6 - idx));
      const monthPaid = paidInvoices.filter((i) => {
        const dt = new Date(i.issueDate);
        return (
          dt.getMonth() === d.getMonth() &&
          dt.getFullYear() === d.getFullYear()
        );
      });
      return {
        month: d.toLocaleString("en-US", { month: "short" }),
        revenue: monthPaid.reduce((s, i) => s + Number(i.total), 0),
        invoices: monthPaid.length,
      };
    });

    // Revenue growth vs previous month
    const currentRev = monthlyRevenue[6]?.revenue ?? 0;
    const prevRev = monthlyRevenue[5]?.revenue ?? 0;
    const revenueGrowth =
      prevRev > 0 ? ((currentRev - prevRev) / prevRev) * 100 : 0;

    return NextResponse.json({
      stats: {
        totalRevenue,
        revenueGrowth: Math.round(revenueGrowth * 10) / 10,
        activeCustomers: customerCount,
        invoicesSentThisMonth: thisMonthInvoices,
        overdueInvoices: overdueCount,
        totalInvoices: invoices.length,
      },
      monthlyRevenue,
      recentInvoices,
      complianceTasks,
      lowStockItems,
    });
  } catch (error) {
    console.error("[GET /api/dashboard]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
