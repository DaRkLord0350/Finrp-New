import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (_req: Request, { organizationId }) => {
  try {
    // Get all loans for the organization
    const loans = await prisma.loan.findMany({
      where: {
        organizationId,
      },
      orderBy: { createdAt: "desc" },
    });

    // Format loans for display
    const applications = loans.map((loan) => ({
      id: loan.id,
      type: loan.loanType,
      amount: Number(loan.loanAmount),
      bank: loan.bank,
      interestRate: Number(loan.interestRate),
      tenure: loan.tenure,
      status: loan.status,
    }));

    return NextResponse.json(applications);
  } catch (error) {
    console.error("Error fetching loan applications:", error);
    return NextResponse.json(
      { error: "Failed to fetch loan applications" },
      { status: 500 }
    );
  }
}, "loans.read");
