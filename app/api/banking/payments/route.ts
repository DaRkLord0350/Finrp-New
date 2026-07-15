// ============================================================
// /api/banking/payments — TBX vendor-bill payments (Maker-Checker)
// GET  — list, newest first, optional ?status= filter (used by the
//        Payments page and the checker approval queue)
// POST — Maker creates a DRAFT payment against a Purchase/Bill
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, ForbiddenError, UnauthorizedError } from "@/lib/auth/require-tenant";
import { createPayment } from "@/lib/tbx/payments/payment.service";
import { InvalidPaymentStateError } from "@/lib/tbx/payments/payment.types";
import type { TbxPaymentStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireTenant({ permission: "banking.read" });
    const status = req.nextUrl.searchParams.get("status") as TbxPaymentStatus | null;

    const payments = await prisma.vendorPayment.findMany({
      where: { organizationId, deletedAt: null, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        purchase: { select: { id: true, purchaseNumber: true, vendorName: true, vendor: { select: { id: true, name: true } } } },
        bankAccount: { select: { id: true, accountName: true, bankName: true } },
        maker: { select: { id: true, name: true } },
        checker: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(payments);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error("[GET /api/banking/payments]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { organizationId, userId, role } = await requireTenant({ permission: "banking.write" });
    const body = await req.json();

    if (!body.purchaseId || !body.bankAccountId || !body.amount || !body.paymentType) {
      return NextResponse.json({ error: "purchaseId, bankAccountId, amount and paymentType are required" }, { status: 400 });
    }

    const payment = await createPayment(
      organizationId,
      {
        purchaseId: body.purchaseId,
        bankAccountId: body.bankAccountId,
        amount: Number(body.amount),
        paymentType: body.paymentType,
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
        makerNote: body.makerNote,
        batchId: body.batchId,
      },
      { userId, role }
    );

    return NextResponse.json(payment, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof InvalidPaymentStateError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("[POST /api/banking/payments]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
