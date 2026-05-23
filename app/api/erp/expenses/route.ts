// ============================================================
// /api/erp/expenses — Expenses CRUD
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenantId = orgId ?? userId;

    const expenses = await prisma.expense.findMany({
      where: { organizationId: tenantId },
      orderBy: { expenseDate: "desc" },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("[GET /api/erp/expenses]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenantId = orgId ?? userId;
    const body = await req.json();

    const expense = await prisma.expense.create({
      data: {
        category: body.category || "OPERATIONS",
        description: body.description,
        amount: body.amount,
        organizationId: tenantId,
        expenseDate: body.expenseDate ? new Date(body.expenseDate) : new Date(),
        vendorName: body.vendorName,
        notes: body.notes,
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("[POST /api/erp/expenses]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
