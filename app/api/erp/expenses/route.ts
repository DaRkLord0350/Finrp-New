// ============================================================
// /api/erp/expenses — Expenses CRUD
// ============================================================

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (_req: Request, { organizationId }) => {
  try {
    const expenses = await prisma.expense.findMany({
      where: { organizationId },
      orderBy: { expenseDate: "desc" },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("[GET /api/erp/expenses]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "erp.read");

export const POST = withAuth(async (req: Request, { organizationId }) => {
  try {
    const body = await req.json();

    const expense = await prisma.expense.create({
      data: {
        category: body.category || "OPERATIONS",
        description: body.description,
        amount: body.amount,
        organizationId,
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
}, "erp.write");
