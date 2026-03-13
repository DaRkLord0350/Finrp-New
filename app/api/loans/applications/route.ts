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
      // Return default empty data for new users
      return NextResponse.json([]);
    }

    // Get all loans for the organization
    const loans = await prisma.loan.findMany({
      where: {
        organizationId: user.organizationId,
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
}
