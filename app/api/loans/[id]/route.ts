import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { organizationId: true },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Get loan and verify it belongs to user's organization
    const loan = await prisma.loan.findUnique({
      where: { id },
    });

    if (!loan || loan.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    return NextResponse.json(loan);
  } catch (error) {
    console.error("[LOAN_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { organizationId: true },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Get loan and verify it belongs to user's organization
    const loan = await prisma.loan.findUnique({
      where: { id },
    });

    if (!loan || loan.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    const body = await request.json();
    const updatedLoan = await prisma.loan.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(updatedLoan);
  } catch (error) {
    console.error("[LOAN_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { organizationId: true },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Get loan and verify it belongs to user's organization
    const loan = await prisma.loan.findUnique({
      where: { id },
    });

    if (!loan || loan.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    await prisma.loan.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[LOAN_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
