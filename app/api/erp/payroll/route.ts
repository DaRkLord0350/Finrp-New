// ============================================================
// /api/erp/payroll — Payroll CRUD
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

    const payroll = await prisma.payroll.findMany({
      where: { organizationId: tenantId },
      orderBy: { paidAt: "desc" },
    });

    return NextResponse.json(payroll);
  } catch (error) {
    console.error("[GET /api/erp/payroll]", error);
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

    const netPay =
      body.netPay ??
      (body.salary || 0) + (body.bonus || 0) - (body.deductions || 0);

    const payroll = await prisma.payroll.create({
      data: {
        employeeName: body.employeeName,
        designation: body.designation,
        salary: body.salary,
        bonus: body.bonus || 0,
        deductions: body.deductions || 0,
        netPay,
        organizationId: tenantId,
        payPeriod: body.payPeriod,
        paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
      },
    });

    return NextResponse.json(payroll, { status: 201 });
  } catch (error) {
    console.error("[POST /api/erp/payroll]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
