import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Health bands are derived from the real net profit margin — never hardcoded.
function classifyHealth(marginPct: number): "Excellent" | "Good" | "Fair" | "Poor" {
  if (marginPct >= 20) return "Excellent";
  if (marginPct >= 10) return "Good";
  if (marginPct >= 0) return "Fair";
  return "Poor";
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const generatedDate = new Date().toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { organizationId: true },
    });

    // No org yet → explicit "insufficient data" state, never invented figures.
    if (!user?.organizationId) {
      return NextResponse.json({
        generatedDate,
        annualTurnover: 0,
        profitMargin: 0,
        financialHealth: "Fair" as const,
        insufficientData: true,
      });
    }

    const organizationId = user.organizationId;

    // Trailing 12 months — a real annual turnover, not monthly × 12.
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(now.getMonth() - 12);

    const [turnoverAgg, expenseAgg] = await Promise.all([
      prisma.invoice.aggregate({
        where: {
          organizationId,
          deletedAt: null,
          status: { notIn: ["DRAFT", "CANCELLED"] },
          issueDate: { gte: twelveMonthsAgo },
        },
        _sum: { total: true },
      }),
      prisma.expense.aggregate({
        where: {
          organizationId,
          deletedAt: null,
          expenseDate: { gte: twelveMonthsAgo },
        },
        _sum: { amount: true, taxAmount: true },
      }),
    ]);

    const turnover = turnoverAgg._sum.total ?? new Prisma.Decimal(0);

    // Without booked revenue we cannot compute a meaningful margin — say so.
    if (turnover.lessThanOrEqualTo(0)) {
      return NextResponse.json({
        generatedDate,
        annualTurnover: 0,
        profitMargin: 0,
        financialHealth: "Fair" as const,
        insufficientData: true,
      });
    }

    const expenses = (expenseAgg._sum.amount ?? new Prisma.Decimal(0)).add(
      expenseAgg._sum.taxAmount ?? new Prisma.Decimal(0)
    );
    const netProfit = turnover.sub(expenses);
    // Decimal arithmetic throughout; round once at the boundary.
    const profitMargin = Number(netProfit.div(turnover).mul(100).toFixed(2));

    return NextResponse.json({
      generatedDate,
      annualTurnover: Number(turnover.toFixed(2)),
      profitMargin,
      financialHealth: classifyHealth(profitMargin),
      insufficientData: false,
    });
  } catch (error) {
    console.error("Error generating CMA report:", error);
    return NextResponse.json(
      { error: "Failed to generate CMA report" },
      { status: 500 }
    );
  }
}
