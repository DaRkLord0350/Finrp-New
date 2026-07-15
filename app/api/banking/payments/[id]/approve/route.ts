// ============================================================
// POST /api/banking/payments/[id]/approve — Checker approves a
// CHECKER_PENDING payment. Requires banking.approve (enforced twice:
// route + service, matching the tax-filing approval pattern), and the
// service independently rejects the same user who created it (Maker
// != Checker). On success, dispatches the actual TBX submission via
// Inngest so this call returns fast.
// ============================================================

import { NextResponse } from "next/server";
import { requireTenant, ForbiddenError, UnauthorizedError } from "@/lib/auth/require-tenant";
import { inngest } from "@/inngest/client";
import { EVENTS } from "@/inngest/events";
import { approvePayment } from "@/lib/tbx/payments/payment.service";
import { InvalidPaymentStateError, SameActorApprovalError } from "@/lib/tbx/payments/payment.types";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId, userId, role } = await requireTenant({ permission: "banking.approve" });
    const { id } = await params;

    const payment = await approvePayment(organizationId, id, { userId, role, canApprove: true });

    await inngest.send({
      name: EVENTS.TBX_PAYMENT_SYNC_REQUESTED,
      data: { organizationId, paymentId: id, action: "DISPATCH", trigger: "MANUAL" },
      id: `tbx.payment-sync:${id}:dispatch:${Date.now()}`,
    });

    return NextResponse.json(payment);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof SameActorApprovalError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof InvalidPaymentStateError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("[POST /api/banking/payments/[id]/approve]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
