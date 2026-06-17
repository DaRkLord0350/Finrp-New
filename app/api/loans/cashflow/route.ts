import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ZERO = new Prisma.Decimal(0);

export async function GET(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json({
        inflows: [],
        outflows: [],
        totalInflow: 0,
        totalOutflow: 0,
        netCashFlow: 0,
      });
    }

    const organizationId = user.organizationId;

    // Trailing 12 months of *actual cash movement* — no placeholder lines.
    const now = new Date();
    const start12 = new Date(now);
    start12.setMonth(now.getMonth() - 12);

    const [receiptsAgg, expenseAgg, emiAgg] = await Promise.all([
      prisma.payment.aggregate({
        where: { organizationId, deletedAt: null, paidAt: { gte: start12 } },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { organizationId, deletedAt: null, expenseDate: { gte: start12 } },
        _sum: { amount: true, taxAmount: true },
      }),
      prisma.loanPayment.aggregate({
        where: { loan: { organizationId }, status: "PAID", paidDate: { gte: start12 } },
        _sum: { amount: true },
      }),
    ]);

    const customerReceipts = receiptsAgg._sum.amount ?? ZERO;
    const operatingExpenses = (expenseAgg._sum.amount ?? ZERO).add(expenseAgg._sum.taxAmount ?? ZERO);
    const loanRepayments = emiAgg._sum.amount ?? ZERO;

    const totalInflowDec = customerReceipts;
    const totalOutflowDec = operatingExpenses.add(loanRepayments);
    const netCashFlowDec = totalInflowDec.sub(totalOutflowDec);

    const num = (d: Prisma.Decimal) => Number(d.toFixed(2));

    return NextResponse.json({
      inflows: [{ label: "Customer Receipts", amount: num(customerReceipts) }],
      outflows: [
        { label: "Operating Expenses", amount: num(operatingExpenses) },
        { label: "Loan Repayments", amount: num(loanRepayments) },
      ],
      totalInflow: num(totalInflowDec),
      totalOutflow: num(totalOutflowDec),
      netCashFlow: num(netCashFlowDec),
    });
  } catch (error) {
    console.error("Error calculating cash flow:", error);
    return NextResponse.json(
      { error: "Failed to calculate cash flow" },
      { status: 500 }
    );
  }
}
