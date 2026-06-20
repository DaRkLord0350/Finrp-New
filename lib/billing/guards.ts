// ============================================================
// lib/billing/guards.ts
//
// SERVER-ONLY entitlement enforcement. Loads an org's plan fields and
// runs the pure resolver (entitlements.ts), then throws structured
// errors that route handlers can serialise to HTTP 402 (Payment
// Required). This is the single place premium features are protected
// on the server — never trust the client to hide a button.
//
// Usage in a route:
//   await requireFeature(FEATURES.INTEGRATIONS); // throws 402 if locked
//
// Usage when taking on a client:
//   await assertWithinClientLimit(caOrganizationId); // throws 402 at limit
// ============================================================

import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { cacheGet, cacheSet, CacheKey, TTL } from "@/lib/cache";
import {
  getEntitlements,
  hasFeature,
  canAddClient,
  withinCount,
  type Entitlements,
  type OrgPlanFields,
} from "./entitlements";
import type { Feature } from "./features";
import { FEATURE_LABELS } from "./features";

// The exact columns the entitlement engine reads — keep in sync with
// OrgPlanFields so the projection stays narrow.
const PLAN_FIELDS_SELECT = {
  billingCategory: true,
  planType: true,
  subscriptionStatus: true,
  clientLimit: true,
  teamLimit: true,
  activeClientCount: true,
  graceLimit: true,
  relationshipStatus: true,
  linkedCAOrganizationId: true,
} as const;

export class FeatureLockedError extends Error {
  readonly status = 402;
  readonly feature: Feature;
  constructor(feature: Feature) {
    super(
      `This feature (${FEATURE_LABELS[feature] ?? feature}) is not included in your current plan.`
    );
    this.name = "FeatureLockedError";
    this.feature = feature;
  }
}

export class PlanLimitError extends Error {
  readonly status = 402;
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

/**
 * Load + resolve an org's entitlements. Cached in Redis for the same
 * TTL as the tenant id; bust with `invalidateEntitlements`.
 */
export async function getOrgEntitlements(
  organizationId: string
): Promise<Entitlements> {
  const cached = await cacheGet<OrgPlanFields>(
    CacheKey.entitlements(organizationId)
  );
  if (cached) return getEntitlements(cached);

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: PLAN_FIELDS_SELECT,
  });
  if (!org) {
    throw new Error(`Organization ${organizationId} not found`);
  }

  await cacheSet(CacheKey.entitlements(organizationId), org, TTL.ENTITLEMENTS);
  return getEntitlements(org);
}

/** Entitlements for the current request's tenant (honours impersonation). */
export async function getCurrentEntitlements(): Promise<Entitlements> {
  const organizationId = await getTenantId();
  if (!organizationId) throw new Error("No tenant in context");
  return getOrgEntitlements(organizationId);
}

/**
 * Whether the org has a live, activated subscription (plan chosen and,
 * for paid plans, paid for). Used by layouts to gate dashboard access.
 */
export async function isOrganizationActivated(
  organizationId: string
): Promise<boolean> {
  const ent = await getOrgEntitlements(organizationId);
  return !!ent.planType && ent.isActive;
}

/** Throw 402 unless the current tenant's plan grants `feature`. */
export async function requireFeature(feature: Feature): Promise<Entitlements> {
  const ent = await getCurrentEntitlements();
  if (!hasFeature(ent, feature)) throw new FeatureLockedError(feature);
  return ent;
}

/** Non-throwing check for the current tenant. */
export async function currentHasFeature(feature: Feature): Promise<boolean> {
  const ent = await getCurrentEntitlements();
  return hasFeature(ent, feature);
}

/** Throw 402 when a CA org has reached its active-client ceiling. */
export async function assertWithinClientLimit(
  caOrganizationId: string
): Promise<Entitlements> {
  const ent = await getOrgEntitlements(caOrganizationId);
  if (!canAddClient(ent)) {
    throw new PlanLimitError(
      `Client limit reached for your plan (${ent.activeClientCount}/${ent.hardClientCeiling}). Upgrade to add more clients.`
    );
  }
  return ent;
}

/**
 * Generic plan-limit enforcement for a count-based resource. Loads the
 * org's entitlements, counts the current usage, and throws a 402
 * PlanLimitError when creating one more would exceed the cap. Legacy /
 * unlimited plans pass through (limit === null). Pass the live count or
 * let the helper count via the provided async counter.
 */
async function assertWithinResourceLimit(
  organizationId: string,
  limitFor: (ent: Entitlements) => number | null,
  count: () => Promise<number>,
  label: string
): Promise<Entitlements> {
  const ent = await getOrgEntitlements(organizationId);
  const limit = limitFor(ent);
  if (limit === null) return ent; // unlimited / legacy
  const used = await count();
  if (!withinCount(limit, used)) {
    throw new PlanLimitError(
      `You've reached your plan's ${label} limit (${used}/${limit}). Upgrade your plan to add more.`
    );
  }
  return ent;
}

/** Throw 402 when the org has reached its CRM-customer cap. */
export async function assertWithinCustomerLimit(
  organizationId: string
): Promise<Entitlements> {
  return assertWithinResourceLimit(
    organizationId,
    (e) => e.customerLimit,
    () => prisma.customer.count({ where: { organizationId } }),
    "customer"
  );
}

/** Throw 402 when the org has reached its invoice cap. */
export async function assertWithinInvoiceLimit(
  organizationId: string
): Promise<Entitlements> {
  return assertWithinResourceLimit(
    organizationId,
    (e) => e.invoiceLimit,
    () => prisma.invoice.count({ where: { organizationId } }),
    "invoice"
  );
}

/** Throw 402 when the org has reached its team-member (user) cap. */
export async function assertWithinUserLimit(
  organizationId: string
): Promise<Entitlements> {
  return assertWithinResourceLimit(
    organizationId,
    (e) => e.userLimit,
    // Active users + still-pending invitations both count toward the seat cap.
    async () => {
      const [users, pending] = await Promise.all([
        prisma.user.count({ where: { organizationId, isActive: true } }),
        prisma.invitation.count({ where: { organizationId, status: "PENDING" } }),
      ]);
      return users + pending;
    },
    "team member"
  );
}

export async function invalidateEntitlements(
  organizationId: string
): Promise<void> {
  const { cacheDel } = await import("@/lib/cache");
  await cacheDel(CacheKey.entitlements(organizationId));
}

/**
 * Convenience for plain (non-withTenant) route handlers: enforce a
 * feature and, if locked, return the 402 NextResponse to send. Returns
 * `null` when the feature is granted so the handler proceeds.
 *
 *   const locked = await featureGate(FEATURES.INTEGRATIONS);
 *   if (locked) return locked;
 */
export async function featureGate(feature: Feature) {
  const { NextResponse } = await import("next/server");
  try {
    await requireFeature(feature);
    return null;
  } catch (err) {
    if (err instanceof FeatureLockedError) {
      return NextResponse.json(
        { error: err.message, feature: err.feature, upgradeRequired: true },
        { status: 402 }
      );
    }
    throw err;
  }
}
