import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (
  _req: Request,
  { organizationId }
) => {
  try {
    // Extract ID from URL
    const url = new URL(_req.url);
    const id = url.pathname.split("/").pop();
    
    if (!id) {
      return NextResponse.json({ error: "Missing loan ID" }, { status: 400 });
    }

    const loan = await prisma.loan.findUnique({
      where: { id },
    });

    if (!loan || loan.organizationId !== organizationId) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    return NextResponse.json(loan);
  } catch (error) {
    console.error("[LOAN_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "loans.read");

export const PUT = withAuth(async (
  request: Request,
  { organizationId }
) => {
  try {
    // Extract ID from URL
    const url = new URL(request.url);
    const id = url.pathname.split("/").pop();
    
    if (!id) {
      return NextResponse.json({ error: "Missing loan ID" }, { status: 400 });
    }

    // Get loan and verify it belongs to user's organization
    const loan = await prisma.loan.findUnique({
      where: { id },
    });

    if (!loan || loan.organizationId !== organizationId) {
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
}, "loans.write");

export const DELETE = withAuth(async (
  _request: Request,
  { organizationId }
) => {
  try {
    // Extract ID from URL
    const url = new URL(_request.url);
    const id = url.pathname.split("/").pop();
    
    if (!id) {
      return NextResponse.json({ error: "Missing loan ID" }, { status: 400 });
    }

    // Get loan and verify it belongs to user's organization
    const loan = await prisma.loan.findUnique({
      where: { id },
    });

    if (!loan || loan.organizationId !== organizationId) {
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
}, "loans.write");
