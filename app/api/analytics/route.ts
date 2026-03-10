import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { orgId } = await auth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [
      invoices,
      customers,
      payments,
    ] = await Promise.all([
      prisma.invoice.findMany({
        where: { organizationId: orgId },
        include: { items: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.customer.count({ where: { organizationId: orgId } }),
      prisma.payment.findMany({
        where: { organizationId: orgId },
        orderBy: { paidAt: "desc" },
      }),
    ]);

    const totalRevenue = Number(
      invoices
        .filter((inv) => inv.status === "PAID")
        .reduce((sum: number, inv) => sum + Number(inv.total), 0)
    );

    const paidInvoices = invoices.filter((inv) => inv.status === "PAID").length;
    const overdueInvoices = invoices.filter((inv) => inv.status === "OVERDUE").length;
    const avgDealSize = paidInvoices > 0 ? totalRevenue / paidInvoices : 0;

    // Monthly revenue for last 7 months
    const now = new Date();
    const monthlyRevenue = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setMonth(d.getMonth() - (6 - i));
      const month = d.toLocaleString("en-US", { month: "short" });
      const year = d.getFullYear();
      const monthInvoices = invoices.filter((inv) => {
        const invDate = new Date(inv.issueDate);
        return (
          invDate.getMonth() === d.getMonth() &&
          invDate.getFullYear() === year &&
          inv.status === "PAID"
        );
      });
      return {
        month,
        revenue: monthInvoices.reduce((s: number, inv) => s + Number(inv.total), 0),
        invoices: monthInvoices.length,
      };
    });

    // Previous month revenue for growth calc
    const currentMonthRev = monthlyRevenue[6]?.revenue || 0;
    const previousMonthRev = monthlyRevenue[5]?.revenue || 1;
    const revenueGrowth =
      previousMonthRev > 0
        ? ((currentMonthRev - previousMonthRev) / previousMonthRev) * 100
        : 0;

    return NextResponse.json({
      totalRevenue,
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
      totalInvoices: invoices.length,
      paidInvoices,
      overdueInvoices,
      totalCustomers: customers,
      avgDealSize: Math.round(avgDealSize),
      monthlyRevenue,
    });
  } catch (error) {
    console.error("[ANALYTICS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
