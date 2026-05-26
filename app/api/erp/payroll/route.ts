// ============================================================
// /api/erp/payroll — Payroll CRUD
// ============================================================

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (_req: Request, { organizationId }) => {
  try {
    const payroll = await prisma.payroll.findMany({
      where: { organizationId },
      orderBy: { paidAt: "desc" },
    });

    return NextResponse.json(payroll);
  } catch (error) {
    console.error("[GET /api/erp/payroll]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "erp.read");

export const POST = withAuth(async (req: Request, { organizationId }) => {
  try {
    const body = await req.json();

    const baseSalary = body.baseSalary || body.salary || 0;
    const hra = body.hra || 0;
    const bonus = body.bonus || 0;
    const allowances = body.allowances || 0;
    const grossPay = baseSalary + hra + bonus + allowances;

    const pf = body.pf || 0;
    const esi = body.esi || 0;
    const tax = body.tax || 0;
    const otherDeductions = body.otherDeductions || 0;
    const totalDeductions = pf + esi + tax + otherDeductions;

    const netPay = body.netPay ?? (grossPay - totalDeductions);

    const payroll = await prisma.payroll.create({
      data: {
        employeeName: body.employeeName,
        designation: body.designation,
        department: body.department || null,
        baseSalary,
        hra,
        bonus,
        allowances,
        overtime: body.overtime || 0,
        grossPay,
        pf,
        esi,
        tax,
        otherDeductions,
        totalDeductions,
        netPay,
        organizationId,
        payPeriod: body.payPeriod,
        payPeriodStart: body.payPeriodStart ? new Date(body.payPeriodStart) : undefined,
        payPeriodEnd: body.payPeriodEnd ? new Date(body.payPeriodEnd) : undefined,
        paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
        attendanceDays: body.attendanceDays || null,
        leaveDays: body.leaveDays || null,
        paymentMethod: body.paymentMethod || "BANK_TRANSFER",
      },
    });

    return NextResponse.json(payroll, { status: 201 });
  } catch (error) {
    console.error("[POST /api/erp/payroll]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "erp.write");
