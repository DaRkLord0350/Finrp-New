import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth/require-tenant";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { organizationId } = await requireTenant();
    const { id } = await params;
    const loan = await prisma.loan.findFirst({ where: { id, organizationId } });
    if (!loan) return NextResponse.json({ error: "Loan not found" }, { status: 404 });
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
    const { organizationId } = await requireTenant();
    const { id } = await params;
    const body = await request.json();
    const result = await prisma.loan.updateMany({ where: { id, organizationId }, data: body });
    if (result.count === 0) return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[LOAN_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { organizationId } = await requireTenant();
    const { id } = await params;
    const result = await prisma.loan.deleteMany({ where: { id, organizationId } });
    if (result.count === 0) return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[LOAN_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
