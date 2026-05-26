import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (_req: Request, { organizationId }) => {
  try {
    // Get paid invoices (inflow)
    const paidInvoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        status: "PAID",
      },
      select: { total: true },
    });

    // Calculate inflows
    const salesRevenue = paidInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    const otherIncome = 25000; // Placeholder
    const totalInflow = salesRevenue + otherIncome;

    // Get loan payments (outflow)
    const loanPayments = await prisma.loanPayment.findMany({
      where: {
        loan: {
          organizationId,
        },
      },
      select: { amount: true },
    });

    // Calculate outflows
    const operatingExpenses = 280000; // Placeholder
    const loanEMIs = loanPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const otherExpenses = 27000; // Placeholder
    const totalOutflow = operatingExpenses + loanEMIs + otherExpenses;

    // Calculate net cash flow
    const netCashFlow = totalInflow - totalOutflow;

    // Format response
    const inflows = [
      { label: "Sales Revenue", amount: salesRevenue },
      { label: "Other Income", amount: otherIncome },
    ];

    const outflows = [
      { label: "Operating Expenses", amount: operatingExpenses },
      { label: "Loan EMIs", amount: loanEMIs },
      { label: "Other Expenses", amount: otherExpenses },
    ];

    return NextResponse.json({
      inflows,
      outflows,
      totalInflow,
      totalOutflow,
      netCashFlow,
    });
  } catch (error) {
    console.error("Error calculating cash flow:", error);
    return NextResponse.json(
      { error: "Failed to calculate cash flow" },
      { status: 500 }
    );
  }
}, "loans.read");
