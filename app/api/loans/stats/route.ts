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

    // No org yet → all-zero/unknown state, never invented figures.
    if (!user?.organizationId) {
      return NextResponse.json({
        annualTurnover: 0,
        turnoverGrowth: null,
        monthlyCashFlow: 0,
        outstandingLoans: 0,
        creditScore: null,
      });
    }

    const organizationId = user.organizationId;

    const now = new Date();
    const start12 = new Date(now);
    start12.setMonth(now.getMonth() - 12);
    const startPrev12 = new Date(now);
    startPrev12.setMonth(now.getMonth() - 24);
    const start1m = new Date(now);
    start1m.setMonth(now.getMonth() - 1);

    const bookedInvoiceFilter = {
      organizationId,
      deletedAt: null,
      status: { notIn: ["DRAFT" as const, "CANCELLED" as const] },
    };

    const [
      currentTurnoverAgg,
      priorTurnoverAgg,
      receiptsAgg,
      expenseAgg,
      emiAgg,
      loans,
      loanWithScore,
    ] = await Promise.all([
      // Trailing-12-month turnover (real booked revenue)
      prisma.invoice.aggregate({
        where: { ...bookedInvoiceFilter, issueDate: { gte: start12 } },
        _sum: { total: true },
      }),
      // Prior 12 months — used only to derive real YoY growth
      prisma.invoice.aggregate({
        where: { ...bookedInvoiceFilter, issueDate: { gte: startPrev12, lt: start12 } },
        _sum: { total: true },
      }),
      // Cash received in the last month
      prisma.payment.aggregate({
        where: { organizationId, deletedAt: null, paidAt: { gte: start1m } },
        _sum: { amount: true },
      }),
      // Operating spend in the last month
      prisma.expense.aggregate({
        where: { organizationId, deletedAt: null, expenseDate: { gte: start1m } },
        _sum: { amount: true, taxAmount: true },
      }),
      // Loan EMIs actually paid in the last month
      prisma.loanPayment.aggregate({
        where: { loan: { organizationId }, status: "PAID", paidDate: { gte: start1m } },
        _sum: { amount: true },
      }),
      // Outstanding principal across live loans
      prisma.loan.findMany({
        where: { organizationId, deletedAt: null, status: { in: ["ACTIVE", "UNDER_REVIEW"] } },
        select: { remainingBalance: true, loanAmount: true },
      }),
      // Most recent real CIBIL score on record, if any
      prisma.loan.findFirst({
        where: { organizationId, deletedAt: null, cibilScore: { not: null } },
        orderBy: { applicationDate: "desc" },
        select: { cibilScore: true },
      }),
    ]);

    const annualTurnover = currentTurnoverAgg._sum.total ?? ZERO;
    const priorTurnover = priorTurnoverAgg._sum.total ?? ZERO;

    // YoY growth only when there is a real prior-year baseline; otherwise unknown.
    const turnoverGrowth = priorTurnover.greaterThan(0)
      ? Number(annualTurnover.sub(priorTurnover).div(priorTurnover).mul(100).toFixed(1))
      : null;

    const receipts = receiptsAgg._sum.amount ?? ZERO;
    const operatingSpend = (expenseAgg._sum.amount ?? ZERO).add(expenseAgg._sum.taxAmount ?? ZERO);
    const emiSpend = emiAgg._sum.amount ?? ZERO;
    const monthlyCashFlow = receipts.sub(operatingSpend).sub(emiSpend);

    const outstandingLoans = loans.reduce(
      (sum, loan) => sum.add(loan.remainingBalance ?? loan.loanAmount),
      ZERO
    );

    return NextResponse.json({
      annualTurnover: Number(annualTurnover.toFixed(2)),
      turnoverGrowth,
      monthlyCashFlow: Number(monthlyCashFlow.toFixed(2)),
      outstandingLoans: Number(outstandingLoans.toFixed(2)),
      creditScore: loanWithScore?.cibilScore ?? null,
    });
  } catch (error) {
    console.error("Error fetching loan stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch loan statistics" },
      { status: 500 }
    );
  }
}
