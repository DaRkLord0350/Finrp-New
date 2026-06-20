// ============================================================
// /api/billing/plan
//
//   GET  → current org's entitlements + the catalog for its category
//   POST → self-serve change plan ({ planType })
//
// Plan changes require org administration (settings.write → OWNER/ADMIN).
// All validation (category lock, CA-link requirement) lives in the
// subscription service.
// ============================================================

import { NextResponse } from "next/server";
import { requireTenant, UnauthorizedError, ForbiddenError } from "@/lib/auth/require-tenant";
import { getOrgEntitlements } from "@/lib/billing/guards";
import { toEntitlementsDTO } from "@/lib/billing/entitlements";
import { getActivePlans, ALL_PLAN_TYPES, isFreePlan } from "@/lib/billing/plans";
import { changePlan, SubscriptionError } from "@/lib/services/subscription.service";
import type { PlanType } from "@prisma/client";

export async function GET() {
  try {
    const { organizationId } = await requireTenant();
    const ent = await getOrgEntitlements(organizationId);
    return NextResponse.json({
      entitlements: toEntitlementsDTO(ent),
      catalog: getActivePlans(),
    });
  } catch (err) {
    return mapError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { organizationId, userId } = await requireTenant({ permission: "settings.write" });
    const body = (await req.json().catch(() => null)) as { planType?: string } | null;
    const planType = body?.planType;

    if (!planType || !ALL_PLAN_TYPES.includes(planType as PlanType)) {
      return NextResponse.json({ error: "Invalid planType" }, { status: 400 });
    }

    // Paid plans must go through Razorpay checkout — never activate on a
    // bare plan-change request. The client should call /api/billing/checkout.
    if (!isFreePlan(planType as PlanType)) {
      return NextResponse.json(
        { needsPayment: true, planType, error: "This plan requires payment" },
        { status: 402 }
      );
    }

    // Free target (e.g. downgrade to Solo) — activate immediately.
    await changePlan(organizationId, planType as PlanType, { actorUserId: userId });
    const ent = await getOrgEntitlements(organizationId);
    return NextResponse.json({ ok: true, entitlements: toEntitlementsDTO(ent) });
  } catch (err) {
    return mapError(err);
  }
}

function mapError(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err instanceof SubscriptionError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  console.error("[/api/billing/plan]", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
