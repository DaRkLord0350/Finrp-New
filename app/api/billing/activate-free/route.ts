// ============================================================
// POST /api/billing/activate-free — activate a free plan
//
// For Solo (CA) during onboarding, or a downgrade to a free tier.
// Connected is granted through the CA relationship flow, not here.
// ============================================================

import { NextResponse } from "next/server";
import { requireTenant, UnauthorizedError, ForbiddenError } from "@/lib/auth/require-tenant";
import { activateFreePlan } from "@/lib/services/billing.service";
import { SubscriptionError } from "@/lib/services/subscription.service";
import { getOrgEntitlements } from "@/lib/billing/guards";
import { toEntitlementsDTO } from "@/lib/billing/entitlements";
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

    await activateFreePlan({ organizationId, planType: planType as PlanType, actorUserId: userId });
    const ent = await getOrgEntitlements(organizationId);
    return NextResponse.json({ ok: true, entitlements: toEntitlementsDTO(ent) });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof SubscriptionError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    console.error("[/api/billing/activate-free]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
