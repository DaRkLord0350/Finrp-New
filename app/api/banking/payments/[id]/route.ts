// ============================================================
// /api/banking/payments/[id] — single VendorPayment, with its full
// Maker-Checker log trail.
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, ForbiddenError, UnauthorizedError } from "@/lib/auth/require-tenant";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "banking.read" });
    const { id } = await params;

    const payment = await prisma.vendorPayment.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        purchase: { select: { id: true, purchaseNumber: true, totalAmount: true, vendor: { select: { id: true, name: true, bankName: true, bankIFSC: true, tbxBeneficiaryId: true } } } },
        bankAccount: { select: { id: true, accountName: true, bankName: true, maskedNumber: true } },
        maker: { select: { id: true, name: true, email: true } },
        checker: { select: { id: true, name: true, email: true } },
        logs: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    return NextResponse.json(payment);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error("[GET /api/banking/payments/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
