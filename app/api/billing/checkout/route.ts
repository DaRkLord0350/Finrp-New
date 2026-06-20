// ============================================================
// POST /api/billing/checkout — create a Razorpay order for a paid plan
//
// Returns the order + public key so the client can open Razorpay
// Checkout. A PENDING BillingPayment row is created server-side; the
// plan is NOT activated here (only /verify or the webhook activates).
// ============================================================

import { NextResponse } from "next/server";
import { requireTenant, UnauthorizedError, ForbiddenError } from "@/lib/auth/require-tenant";
import { readCurrentUser } from "@/lib/auth/session";
import { createCheckoutOrder } from "@/lib/services/billing.service";
import { SubscriptionError } from "@/lib/services/subscription.service";
import { RazorpayError } from "@/lib/billing/razorpay";
import { ALL_PLAN_TYPES } from "@/lib/billing/plans";
import type { PlanType } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const { organizationId, userId } = await requireTenant({ permission: "settings.write" });
    const body = (await req.json().catch(() => null)) as { planType?: string } | null;
    const planType = body?.planType;

    if (!planType || !ALL_PLAN_TYPES.includes(planType as PlanType)) {
      return NextResponse.json({ error: "Invalid planType" }, { status: 400 });
    }

    const order = await createCheckoutOrder({
      organizationId,
      planType: planType as PlanType,
      actorUserId: userId,
    });

    // Prefill for the Checkout widget (name / email / contact).
    const user = await readCurrentUser();
    return NextResponse.json({
      ...order,
      prefill: {
        name: user?.name ?? "",
        email: user?.email ?? "",
        contact: user?.phone ?? "",
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof SubscriptionError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    if (err instanceof RazorpayError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[/api/billing/checkout]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
