// ============================================================
// GET /api/billing/history — this org's billing/payment history
// ============================================================

import { NextResponse } from "next/server";
import { requireTenant, UnauthorizedError, ForbiddenError } from "@/lib/auth/require-tenant";
import { listBillingHistory } from "@/lib/services/billing.service";

export async function GET() {
  try {
    const { organizationId } = await requireTenant({ permission: "settings.read" });
    const payments = await listBillingHistory(organizationId);
    return NextResponse.json({
      payments: payments.map((p) => ({
        id: p.id,
        planType: p.planType,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        method: p.method,
        invoiceNumber: p.invoiceNumber,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        createdAt: p.createdAt,
      })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error("[/api/billing/history]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
