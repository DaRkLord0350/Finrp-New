// ============================================================
// /api/erp/purchases/[id] — single Purchase (Bill), with vendor
// (incl. TBX beneficiary state) and its TBX payment history, so the
// Pay Bill flow has everything it needs in one round trip.
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, ForbiddenError, UnauthorizedError } from "@/lib/auth/require-tenant";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "erp.read" });
    const { id } = await params;

    const purchase = await prisma.purchase.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        vendor: true,
        items: true,
        vendorPayments: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: {
            bankAccount: { select: { id: true, accountName: true, bankName: true } },
            maker: { select: { id: true, name: true } },
            checker: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    return NextResponse.json(purchase);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error("[GET /api/erp/purchases/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
