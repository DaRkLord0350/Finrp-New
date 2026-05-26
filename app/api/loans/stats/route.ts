import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (_req: Request, { organizationId }) => {
  try {
    // Get business profile for financial data
    const businessProfile = await prisma.businessProfile.findUnique({
      where: { organizationId },
    });

    // Get all invoices for turnover calculation
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        status: "PAID",
      },
      select: { total: true },
    });

    // Get active loans
    const loans = await prisma.loan.findMany({
      where: {
        organizationId,
        status: { in: ["ACTIVE", "UNDER_REVIEW"] },
      },
      select: { loanAmount: true },
    });

    // Calculate metrics
    const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    const annualTurnover = totalRevenue * 12; // Simplified: multiply monthly average by 12
    const monthlyCashFlow = totalRevenue; // Average monthly cash flow
    const outstandingLoans = loans.reduce((sum, loan) => sum + Number(loan.loanAmount), 0);
    const creditScore = 750; // Default score - can be enhanced with external API

    return NextResponse.json({
      annualTurnover,
      turnoverGrowth: 15, // Placeholder - could be calculated from historical data
      monthlyCashFlow,
      outstandingLoans,
      creditScore,
    });
  } catch (error) {
    console.error("Error fetching loan stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch loan statistics" },
      { status: 500 }
    );
  }
}, "loans.read");
