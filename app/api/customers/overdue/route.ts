import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { orgId } = await auth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get all overdue invoices for the organization
    const now = new Date();
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        organizationId: orgId,
        dueDate: { lt: now },
        status: { in: ["OVERDUE", "PARTIAL"] },
      },
      include: {
        customer: true,
      },
      orderBy: { dueDate: "asc" },
    });

    // Group by customer and aggregate
    const customerMap = new Map<string, (typeof overdueInvoices[0])[]>();
    overdueInvoices.forEach((inv) => {
      if (!customerMap.has(inv.customerId)) {
        customerMap.set(inv.customerId, []);
      }
      customerMap.get(inv.customerId)!.push(inv);
    });

    // Transform to customer-centric view
    const overdueCustomers = Array.from(customerMap.entries()).map(([customerId, invoices]) => {
      const customer = invoices[0].customer;
      const totalOverdue = invoices.reduce((sum, inv) => sum + Number(inv.balanceDue), 0);
      const oldestDueDate = invoices.reduce((oldest, inv) => {
        return inv.dueDate < oldest ? inv.dueDate : oldest;
      }, invoices[0].dueDate);
      const dayOverdue = Math.floor((now.getTime() - oldestDueDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        ...customer,
        totalOverdue,
        overdueInvoiceCount: invoices.length,
        oldestDueDate,
        dayOverdue,
      };
    });

    return NextResponse.json(overdueCustomers);
  } catch (error) {
    console.error("[CUSTOMERS_OVERDUE_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
