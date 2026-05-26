import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (_req: Request, { organizationId }) => {
  try {
    // Get customers with highest total purchases (revenue)
    const topCustomers = await prisma.customer.findMany({
      where: { organizationId },
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
}, "customers.read");
