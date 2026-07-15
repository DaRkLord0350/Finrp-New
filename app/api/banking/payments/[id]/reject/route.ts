// ============================================================
// POST /api/banking/payments/[id]/reject { reason } — Checker
// rejects a CHECKER_PENDING payment. Requires banking.approve.
// ============================================================

import { NextResponse } from "next/server";
import { requireTenant, ForbiddenError, UnauthorizedError } from "@/lib/auth/require-tenant";
import { rejectPayment } from "@/lib/tbx/payments/payment.service";
import { InvalidPaymentStateError } from "@/lib/tbx/payments/payment.types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId, userId, role } = await requireTenant({ permission: "banking.approve" });
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : "No reason provided";

    const payment = await rejectPayment(organizationId, id, { userId, role, canApprove: true }, reason);
    return NextResponse.json(payment);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof InvalidPaymentStateError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("[POST /api/banking/payments/[id]/reject]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
