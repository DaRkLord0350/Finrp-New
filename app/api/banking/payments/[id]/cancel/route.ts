// ============================================================
// POST /api/banking/payments/[id]/cancel — Maker cancels their own
// DRAFT or CHECKER_PENDING payment before it's dispatched to TBX.
// ============================================================

import { NextResponse } from "next/server";
import { requireTenant, ForbiddenError, UnauthorizedError } from "@/lib/auth/require-tenant";
import { cancelPayment } from "@/lib/tbx/payments/payment.service";
import { InvalidPaymentStateError } from "@/lib/tbx/payments/payment.types";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId, userId, role } = await requireTenant({ permission: "banking.write" });
    const { id } = await params;

    const payment = await cancelPayment(organizationId, id, { userId, role });
    return NextResponse.json(payment);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof InvalidPaymentStateError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("[POST /api/banking/payments/[id]/cancel]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
