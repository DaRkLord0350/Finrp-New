import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { organizationId: true },
    });

    if (!user) {
      // Return default stats for new users
      return NextResponse.json({
        annualTurnover: 0,
        turnoverGrowth: 0,
        monthlyCashFlow: 0,
        outstandingLoans: 0,
        creditScore: 0,
      });
    }

    // Get business profile for financial data
    const businessProfile = await prisma.businessProfile.findUnique({
      where: { organizationId: user.organizationId },
    });

    // Get all invoices for turnover calculation
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: user.organizationId,
        status: "PAID",
      },
      select: { total: true },
    });

    // Get active loans
    const loans = await prisma.loan.findMany({
      where: {
        organizationId: user.organizationId,
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
}
