import { prisma } from "@/lib/prisma";
import type { Decimal } from "@prisma/client/runtime/library";

// Infer types from Prisma select shapes
type InvoiceSelectRow = {
  total: Decimal;
  status: string;
  issueDate: Date;
  customerId: string;
};

type CustomerWithInvoices = {
  id: string;
  name: string;
  company: string | null;
  invoices: { total: Decimal }[];
};

export const analyticsService = {
  async getSummary(organizationId: string) {
    const [invoices, customerCount] = await Promise.all([
      prisma.invoice.findMany({
        where: { organizationId },
        select: { total: true, status: true, issueDate: true, customerId: true },
      }) as Promise<InvoiceSelectRow[]>,
      prisma.customer.count({ where: { organizationId } }),
    ]);

    const paidInvoices = invoices.filter((inv: InvoiceSelectRow) => inv.status === "PAID");
    const totalRevenue = paidInvoices.reduce((s: number, inv: InvoiceSelectRow) => s + Number(inv.total), 0);
    const avgDealSize = paidInvoices.length > 0 ? totalRevenue / paidInvoices.length : 0;
    const overdueCount = invoices.filter((inv: InvoiceSelectRow) => inv.status === "OVERDUE").length;

    // Monthly revenue last 7 months
    const now = new Date();
    const monthly = Array.from({ length: 7 }, (_: unknown, idx: number) => {
      const d = new Date(now);
      d.setMonth(d.getMonth() - (6 - idx));
      const monthPaid = paidInvoices.filter((inv: InvoiceSelectRow) => {
        const dt = new Date(inv.issueDate);
        return dt.getMonth() === d.getMonth() && dt.getFullYear() === d.getFullYear();
      });
      return {
        month: d.toLocaleString("en-US", { month: "short" }),
        revenue: monthPaid.reduce((s: number, inv: InvoiceSelectRow) => s + Number(inv.total), 0),
        invoices: monthPaid.length,
      };
    });

    const currentRev = monthly[6]?.revenue ?? 0;
    const prevRev = monthly[5]?.revenue ?? 1;
    const growth = prevRev > 0 ? ((currentRev - prevRev) / prevRev) * 100 : 0;

    return {
      totalRevenue,
      revenueGrowth: Math.round(growth * 10) / 10,
      totalInvoices: invoices.length,
      paidInvoices: paidInvoices.length,
      overdueInvoices: overdueCount,
      totalCustomers: customerCount,
      avgDealSize: Math.round(avgDealSize),
      monthlyRevenue: monthly,
    };
  },

  async getTopCustomers(organizationId: string, limit = 5) {
    const customers = await prisma.customer.findMany({
      where: { organizationId },
      include: {
        invoices: {
          where: { status: "PAID" },
          select: { total: true },
        },
      },
    }) as unknown as CustomerWithInvoices[];

    return customers
      .map((c: CustomerWithInvoices) => ({
        id: c.id,
        name: c.name,
        company: c.company,
        totalRevenue: c.invoices.reduce((s: number, inv: { total: Decimal }) => s + Number(inv.total), 0),
        invoiceCount: c.invoices.length,
      }))
      .sort((a: { totalRevenue: number }, b: { totalRevenue: number }) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);
  },
};
