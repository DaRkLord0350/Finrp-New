import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { userId, orgId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = orgId ?? userId;

    const [invoices, customers, payments] = await Promise.all([
      prisma.invoice.findMany({
        where: { organizationId: tenantId },
        include: {
          items: true,
          customer: { select: { id: true, name: true } }, // ← join customer name
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.customer.count({ where: { organizationId: tenantId } }),
      prisma.payment.findMany({
        where: { organizationId: tenantId },
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
        expenses: 0, // extend later if expense model exists
        invoices: monthInvoices.length,
      };
    });

    const currentMonthRev = monthlyRevenue[6]?.revenue || 0;
    const previousMonthRev = monthlyRevenue[5]?.revenue || 1;
    const revenueGrowth =
      previousMonthRev > 0
        ? ((currentMonthRev - previousMonthRev) / previousMonthRev) * 100
        : 0;

    // Invoice status mix percentages
    const total = invoices.length || 1;
    const paymentMix = [
      { name: "Paid", value: Math.round((paidInvoices / total) * 100), color: "#10b981" },
      { name: "Outstanding", value: Math.round((invoices.filter(i => i.status === "SENT").length / total) * 100), color: "#3b82f6" },
      { name: "Overdue", value: Math.round((overdueInvoices / total) * 100), color: "#ef4444" },
      { name: "Draft", value: Math.round((invoices.filter(i => i.status === "DRAFT").length / total) * 100), color: "#52525b" },
    ];

    // Top customers by revenue from paid invoices
    const customerRevMap: Record<string, { name: string; revenue: number }> = {};
    invoices
      .filter((inv) => inv.status === "PAID")
      .forEach((inv) => {
        if (!customerRevMap[inv.customerId]) {
          customerRevMap[inv.customerId] = {
            name: inv.customer?.name ?? inv.customerId, // ← use real customer name
            revenue: 0,
          };
        }
        customerRevMap[inv.customerId].revenue += Number(inv.total);
      });
    const topCustomers = Object.values(customerRevMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    void payments; // reserved for future use

    return NextResponse.json({
      totalRevenue,
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
      totalInvoices: invoices.length,
      paidInvoices,
      overdueInvoices,
      totalCustomers: customers,
      avgDealSize: Math.round(avgDealSize),
      monthlyRevenue,
      paymentMix,
      topCustomers,
    });
  } catch (error) {
    console.error("[ANALYTICS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
