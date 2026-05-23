import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Verify customer belongs to organization
    const customer = await prisma.customer.findFirst({
      where: { id, organizationId: orgId },
      include: {
        invoices: true,
        sales: true,
      },
    });

    if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Calculate analytics metrics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Revenue metrics
    const totalRevenue = customer.invoices
      .filter((inv) => inv.status === "PAID")
      .reduce((sum, inv) => sum + Number(inv.total), 0);

    const revenue30Days = customer.invoices
      .filter((inv) => inv.status === "PAID" && inv.createdAt >= thirtyDaysAgo)
      .reduce((sum, inv) => sum + Number(inv.total), 0);

    const revenue90Days = customer.invoices
      .filter((inv) => inv.status === "PAID" && inv.createdAt >= ninetyDaysAgo)
      .reduce((sum, inv) => sum + Number(inv.total), 0);

    const revenue365Days = customer.invoices
      .filter((inv) => inv.status === "PAID" && inv.createdAt >= oneYearAgo)
      .reduce((sum, inv) => sum + Number(inv.total), 0);

    // Transaction metrics
    const invoiceCount = customer.invoices.length;
    const invoices30Days = customer.invoices.filter((inv) => inv.createdAt >= thirtyDaysAgo).length;

    // Outstanding balance
    const outstandingAmount = customer.invoices
      .filter((inv) => inv.status === "PARTIAL" || inv.status === "OVERDUE")
      .reduce((sum, inv) => sum + Number(inv.balanceDue), 0);

    const overdueAmount = customer.invoices
      .filter((inv) => inv.status === "OVERDUE")
      .reduce((sum, inv) => sum + Number(inv.balanceDue), 0);

    const overdueInvoiceCount = customer.invoices.filter((inv) => inv.status === "OVERDUE").length;

    // Average metrics
    const avgTransactionValue = invoiceCount > 0 ? totalRevenue / invoiceCount : 0;
    const avgTransactionFrequency = invoiceCount > 0 ? invoiceCount / 12 : 0; // per month

    // Calculate retention (days since last purchase)
    const lastPurchaseDate = customer.invoices.reduce((latest, inv) => {
      return inv.createdAt > latest ? inv.createdAt : latest;
    }, new Date(0));
    const daysSinceLastPurchase = lastPurchaseDate.getTime() > 0 
      ? Math.floor((now.getTime() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Customer Lifetime Value (CLV)
    // CLV = Average Transaction Value × Retention Rate × Average Purchase Frequency
    const retentionRate = invoiceCount > 0 ? 100 : 0; // Assuming active = 100% retention
    const clv = avgTransactionValue * (retentionRate / 100) * avgTransactionFrequency * 12; // annual

    // Payment metrics
    const paidInvoices = customer.invoices.filter((inv) => inv.status === "PAID").length;
    const paymentRate = invoiceCount > 0 ? (paidInvoices / invoiceCount) * 100 : 0;

    // Credit limit and utilization
    const creditLimit = Number(customer.creditLimit) || 0;
    const creditUtilization = creditLimit > 0 ? (Number(customer.outstandingAmount) / creditLimit) * 100 : 0;

    // Transaction trend (last 6 months)
    const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
    const monthlyTransactions: Record<string, number> = {};
    customer.invoices
      .filter((inv) => inv.createdAt >= sixMonthsAgo)
      .forEach((inv) => {
        const monthKey = inv.createdAt.toISOString().slice(0, 7); // YYYY-MM
        monthlyTransactions[monthKey] = (monthlyTransactions[monthKey] || 0) + Number(inv.total);
      });

    return NextResponse.json({
      customerId: customer.id,
      customerName: customer.name,
      customerType: customer.customerType,

      // Revenue KPIs
      revenue: {
        total: Math.round(totalRevenue * 100) / 100,
        last30Days: Math.round(revenue30Days * 100) / 100,
        last90Days: Math.round(revenue90Days * 100) / 100,
        last365Days: Math.round(revenue365Days * 100) / 100,
        average: Math.round(avgTransactionValue * 100) / 100,
      },

      // Transaction KPIs
      transactions: {
        total: invoiceCount,
        last30Days: invoices30Days,
        avgFrequencyMonthly: Math.round(avgTransactionFrequency * 100) / 100,
      },

      // Outstanding balance
      outstanding: {
        amount: Math.round(Number(customer.outstandingAmount) * 100) / 100,
        overdueAmount: Math.round(overdueAmount * 100) / 100,
        overdueInvoices: overdueInvoiceCount,
      },

      // Payment metrics
      payment: {
        rate: Math.round(paymentRate * 100) / 100, // percentage
        paidInvoices,
        pendingInvoices: invoiceCount - paidInvoices,
      },

      // Credit metrics
      credit: {
        limit: Math.round(creditLimit * 100) / 100,
        utilized: Math.round(Number(customer.outstandingAmount) * 100) / 100,
        utilizationRate: Math.round(creditUtilization * 100) / 100,
        available: Math.round((creditLimit - Number(customer.outstandingAmount)) * 100) / 100,
      },

      // Lifecycle metrics
      lifecycle: {
        customerScore: customer.customerScore || 0,
        daysSinceLastPurchase,
        customerLifetimeValue: Math.round(clv * 100) / 100,
        retentionRate: Math.round(retentionRate * 100) / 100,
        accountAge: Math.floor((now.getTime() - customer.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      },

      // Trend data
      monthlyTrend: monthlyTransactions,

      // Status summary
      status: {
        isActive: customer.isActive,
        lastPurchaseDate,
        accountCreatedDate: customer.createdAt,
      },
    });
  } catch (error) {
    console.error("[CUSTOMER_ANALYTICS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
