// ============================================================
// POST /api/billing/verify — verify a Razorpay payment + activate
//
// The client posts the Checkout result; the server RE-VERIFIES the
// signature and only then activates the plan + records the invoice.
// Client-reported success alone never activates anything.
// ============================================================

import { NextResponse } from "next/server";
import { requireTenant, UnauthorizedError, ForbiddenError } from "@/lib/auth/require-tenant";
import { activatePaidPlan } from "@/lib/services/billing.service";
import { SubscriptionError } from "@/lib/services/subscription.service";
import { getOrgEntitlements } from "@/lib/billing/guards";
import { toEntitlementsDTO } from "@/lib/billing/entitlements";

export async function POST(req: Request) {
  try {
    const { organizationId, userId } = await requireTenant({ permission: "settings.write" });
    const body = (await req.json().catch(() => null)) as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    } | null;

    if (!body?.razorpay_order_id || !body?.razorpay_payment_id || !body?.razorpay_signature) {
      return NextResponse.json({ error: "Missing payment fields" }, { status: 400 });
    }

    const result = await activatePaidPlan({
      organizationId,
      razorpayOrderId: body.razorpay_order_id,
      razorpayPaymentId: body.razorpay_payment_id,
      razorpaySignature: body.razorpay_signature,
      actorUserId: userId,
    });

    const ent = await getOrgEntitlements(organizationId);
    return NextResponse.json({ ok: true, ...result, entitlements: toEntitlementsDTO(ent) });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof SubscriptionError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    console.error("[/api/billing/verify]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
