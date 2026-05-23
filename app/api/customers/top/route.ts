import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { orgId } = await auth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get customers with highest total purchases (revenue)
    const topCustomers = await prisma.customer.findMany({
      where: { organizationId: orgId },
      include: {
        _count: { select: { invoices: true } },
        invoices: {
          select: { total: true, status: true },
        },
      },
      orderBy: { totalPurchases: "desc" },
      take: 10,
    });

    // Enrich with calculated metrics
    const enriched = topCustomers.map((c) => {
      const paidInvoices = c.invoices.filter((inv) => inv.status === "PAID");
      const totalRevenue = paidInvoices.reduce((s, inv) => s + Number(inv.total), 0);
      const outstandingRevenue = c.invoices
        .filter((inv) => inv.status === "PARTIAL" || inv.status === "OVERDUE")
        .reduce((s, inv) => s + Number(inv.total), 0);

      return {
        ...c,
        totalRevenue,
        outstandingRevenue,
        invoiceCount: c._count.invoices,
        invoices: undefined,
        _count: undefined,
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("[CUSTOMERS_TOP_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
