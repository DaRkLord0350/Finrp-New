// ============================================================
// lib/services/subscription.service.ts
//
// The authoritative writer for an org's plan state. Every plan change
// — onboarding, self-serve upgrade/downgrade, free Connected grants,
// and the automatic Standalone → Connected conversion — flows through
// here so the Organization row, the Subscription row, and the
// entitlement cache stay consistent.
//
// Money is INR rupees from the plan catalog (lib/billing/plans.ts).
// All writes are transactional; the entitlement cache is busted after.
// ============================================================

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type {
  BillingCategory,
  PlanType,
  SubscriptionStatus,
} from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { invalidateEntitlements } from "@/lib/billing/guards";
import { getPlan, isFreePlan } from "@/lib/billing/plans";

export class SubscriptionError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "SubscriptionError";
    this.code = code;
    this.status = status;
  }
}

type Tx = Prisma.TransactionClient;

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Low-level: write a plan onto an org + its Subscription row inside a
 * transaction. Does NOT validate eligibility (callers do) — it only
 * keeps the denormalised fields consistent with the catalog.
 */
export async function writePlan(
  tx: Tx,
  organizationId: string,
  planType: PlanType,
  opts: {
    status: SubscriptionStatus;
    cancelAtPeriodEnd?: boolean;
    keepLinkedCA?: boolean;
    /** Explicit billing period (paid activation passes this). */
    periodStart?: Date;
    periodEnd?: Date | null;
    razorpayCustomerId?: string | null;
    razorpaySubscriptionId?: string | null;
  }
): Promise<void> {
  const plan = getPlan(planType);
  const free = isFreePlan(planType);
  const now = new Date();
  const periodStart = opts.periodStart ?? now;
  const periodEnd =
    opts.periodEnd !== undefined
      ? opts.periodEnd
      : free
      ? null
      : new Date(now.getTime() + MONTH_MS);

  await tx.organization.update({
    where: { id: organizationId },
    data: {
      // billingCategory is set once at onboarding (CA vs Business) and is
      // NOT derived from the plan — the catalog is universal now.
      planType,
      subscriptionStatus: opts.status,
      clientLimit: plan.clientLimit,
      teamLimit: plan.teamLimit,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      ...(opts.razorpayCustomerId !== undefined ? { razorpayCustomerId: opts.razorpayCustomerId } : {}),
      ...(opts.razorpaySubscriptionId !== undefined ? { razorpaySubscriptionId: opts.razorpaySubscriptionId } : {}),
    },
  });

  await tx.subscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      // Map the new model onto the legacy `Subscription.plan` enum so old
      // reporting keeps working: free→FREE, paid CA→GROWTH, paid biz→STARTER.
      plan: legacyPlanFor(planType),
      status: opts.status.toLowerCase(),
      amount: new Prisma.Decimal(plan.priceMonthly),
      currency: "INR",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: opts.cancelAtPeriodEnd ?? false,
    },
    update: {
      plan: legacyPlanFor(planType),
      status: opts.status.toLowerCase(),
      amount: new Prisma.Decimal(plan.priceMonthly),
      currency: "INR",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: opts.cancelAtPeriodEnd ?? false,
    },
  });
}

/**
 * Validate a target plan is assignable. The catalog is now universal —
 * any org may pick any of the four active tiers — so this only guards
 * against an unknown/legacy plan type being requested directly. Shared
 * by changePlan and the checkout-order creation path.
 */
export function assertPlanEligible(target: PlanType): void {
  const plan = getPlan(target);
  if (plan.type !== target) {
    throw new SubscriptionError(
      "INVALID_PLAN",
      "That plan is no longer available. Please choose a current plan.",
      409
    );
  }
}

// Map onto the legacy Plan enum (kept for backward compat). The active
// tier names (FREE/STARTER/GROWTH/ENTERPRISE) align 1:1 with the enum;
// getPlan normalises any legacy input first.
function legacyPlanFor(planType: PlanType): "FREE" | "STARTER" | "GROWTH" | "ENTERPRISE" {
  return getPlan(planType).type;
}

/**
 * Initialise an org's billing category at the end of profile onboarding.
 * The concrete plan is chosen explicitly afterwards at /onboarding/plan
 * (pricing cards + payment), so NO plan is auto-assigned here — this just
 * records CA vs Business so the plan step knows which cards to show.
 */
export async function initializeBilling(
  organizationId: string,
  category: BillingCategory,
  actorUserId?: string
): Promise<void> {
  await prisma.organization.update({
    where: { id: organizationId },
    data: { billingCategory: category },
  });

  await invalidateEntitlements(organizationId);
  await createAuditLog({
    organizationId,
    userId: actorUserId,
    action: "UPDATE",
    entity: "subscription",
    description: `Initialised billing category as ${category}`,
    newValue: { billingCategory: category },
  });
}

export interface ChangePlanOptions {
  actorUserId?: string;
}

/**
 * Self-serve plan change to a FREE tier (paid tiers go through Razorpay
 * checkout, not this path). Validates the target is a current plan, then
 * writes it. The catalog is universal, so there are no category/CA-link
 * constraints.
 */
export async function changePlan(
  organizationId: string,
  target: PlanType,
  options: ChangePlanOptions = {}
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { planType: true },
  });
  if (!org) throw new SubscriptionError("ORG_NOT_FOUND", "Organization not found", 404);

  assertPlanEligible(target);

  await prisma.$transaction(async (tx) => {
    await writePlan(tx, organizationId, target, { status: "ACTIVE" });
  });

  await invalidateEntitlements(organizationId);
  await createAuditLog({
    organizationId,
    userId: options.actorUserId,
    action: "UPDATE",
    entity: "subscription",
    description: `Changed plan ${org.planType ?? "—"} → ${target}`,
    oldValue: { planType: org.planType },
    newValue: { planType: target },
  });
}

/**
 * Link a business to an active CA (the CARelationship accept flow). The
 * catalog is universal, so linking no longer changes a paying business's
 * plan — it simply records the link. A business that has NOT yet chosen a
 * plan is activated on the **Free** tier so it isn't left un-activated.
 * Data is always preserved. Idempotent.
 *
 * (Name kept for backward compatibility with the relationship service.)
 *
 * @param tx  optional transaction client (the relationship-accept flow
 *            passes its own tx so the link + plan commit atomically).
 */
export async function applyConnectedPlan(
  organizationId: string,
  caOrganizationId: string,
  actorUserId?: string,
  tx?: Tx
): Promise<{ converted: boolean; previousPlan: PlanType | null }> {
  const run = async (client: Tx) => {
    const org = await client.organization.findUnique({
      where: { id: organizationId },
      select: { planType: true, billingCategory: true },
    });
    if (!org) {
      throw new SubscriptionError("ORG_NOT_FOUND", "Business organization not found", 404);
    }

    const previousPlan = org.planType;
    const needsPlan = !previousPlan; // no plan chosen yet → activate Free

    await client.organization.update({
      where: { id: organizationId },
      data: {
        billingCategory: org.billingCategory ?? "BUSINESS",
        linkedCAOrganizationId: caOrganizationId,
        relationshipStatus: "ACTIVE",
        ...(needsPlan
          ? {
              planType: "FREE",
              subscriptionStatus: "ACTIVE",
              clientLimit: getPlan("FREE").clientLimit,
              teamLimit: getPlan("FREE").teamLimit,
            }
          : {}),
      },
    });

    if (needsPlan) {
      await client.subscription.upsert({
        where: { organizationId },
        create: {
          organizationId,
          plan: "FREE",
          status: "active",
          amount: new Prisma.Decimal(0),
          currency: "INR",
          currentPeriodStart: new Date(),
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        },
        update: { plan: "FREE", status: "active", amount: new Prisma.Decimal(0) },
      });
    }

    return { converted: false, previousPlan };
  };

  const result = tx ? await run(tx) : await prisma.$transaction(run);

  await invalidateEntitlements(organizationId);
  await createAuditLog({
    organizationId,
    userId: actorUserId,
    action: "UPDATE",
    entity: "subscription",
    description: result.previousPlan
      ? `Linked to CA (kept ${getPlan(result.previousPlan).name} plan, data preserved)`
      : "Linked to CA and activated the Free plan",
    oldValue: { planType: result.previousPlan },
    newValue: { linkedCAOrganizationId: caOrganizationId },
  });

  return result;
}

/**
 * Reverse of the link: when a business loses its CA, clear the link
 * fields. The business keeps its own plan (universal catalog), so no
 * plan change is forced. Data is preserved.
 */
export async function onCALinkRemoved(
  organizationId: string,
  actorUserId?: string,
  tx?: Tx
): Promise<void> {
  const run = async (client: Tx) => {
    await client.organization.update({
      where: { id: organizationId },
      data: {
        linkedCAOrganizationId: null,
        relationshipStatus: "TERMINATED",
      },
    });
  };

  if (tx) await run(tx);
  else await prisma.$transaction(run);

  await invalidateEntitlements(organizationId);
}
