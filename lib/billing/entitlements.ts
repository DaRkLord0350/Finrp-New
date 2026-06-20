// ============================================================
// lib/billing/entitlements.ts
//
// Pure entitlement resolution: given an org's plan fields, decide
// which features it may use and which limits apply. No I/O — this is
// the deterministic core that both the server guards
// (lib/billing/guards.ts) and the UI read from.
//
// ONE UNIVERSAL CATALOG: every org (CA firm or business) is on one of
// Free / Starter / Growth / Enterprise. Limits scale per tier and are
// resolved from the catalog (lib/billing/plans.ts).
//
// GRANDFATHERING: an org that has not yet adopted the pricing model
// (planType null) is treated as LEGACY — fully unlocked, no limits — so
// existing functionality is never broken by the rollout.
//
// LAPSED PAID PLANS: a paid plan in a non-active status falls back to
// the Free floor so data is never lost and the account degrades
// gracefully. The Free plan itself is always active.
//
// CLIENT-SAFE: type-only Prisma imports + the plan catalog.
// ============================================================

import type {
  BillingCategory,
  PlanType,
  RelationshipStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { FEATURES, type Feature } from "./features";
import { PLAN_CATALOG, getPlan, type ActivePlanType } from "./plans";

/** The minimal Organization projection the entitlement engine needs. */
export interface OrgPlanFields {
  billingCategory: BillingCategory | null;
  planType: PlanType | null;
  subscriptionStatus: SubscriptionStatus;
  clientLimit: number | null;
  teamLimit: number | null;
  activeClientCount: number;
  graceLimit: number;
  relationshipStatus: RelationshipStatus | null;
  linkedCAOrganizationId: string | null;
}

export interface Entitlements {
  /** The plan the org is *subscribed* to (raw — may be a legacy value). */
  planType: PlanType | null;
  /** The active tier in force after status/floor resolution. */
  effectivePlanType: ActivePlanType | null;
  category: BillingCategory | null;
  status: SubscriptionStatus;
  /** Org has not adopted the pricing model → fully unlocked. */
  isLegacy: boolean;
  /** Effective plan is live (free plan, or paid + active/trialing, or legacy). */
  isActive: boolean;
  /** Paid plan that is not currently in good standing. */
  lapsed: boolean;
  features: Set<Feature>;
  /** AI features (insights, forecasting) granted by the effective plan. */
  aiEnabled: boolean;
  // ── Limits (null = unlimited) ───────────────────────────────
  /** CRM customers. */
  customerLimit: number | null;
  /** Invoices. */
  invoiceLimit: number | null;
  /** Team members / users. */
  userLimit: number | null;
  /** Max active clients (CA). */
  clientLimit: number | null;
  /** Max team members (CA) — alias of userLimit, kept for compat. */
  teamLimit: number | null;
  graceLimit: number;
  /** clientLimit + graceLimit (`null` = unlimited). */
  hardClientCeiling: number | null;
  activeClientCount: number;
  /** Slots left before the ceiling (`null` = unlimited). */
  remainingClients: number | null;
  withinClientLimit: boolean;
  linkedToActiveCA: boolean;
}

const ACTIVE_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  "ACTIVE",
  "TRIALING",
]);

function allFeatures(): Feature[] {
  return Object.values(FEATURES);
}

/** The capability set granted by a plan (for tests / analytics / UI). */
export function planFeatureSet(planType: PlanType): Set<Feature> {
  return new Set(getPlan(planType).features);
}

export function getEntitlements(org: OrgPlanFields): Entitlements {
  const linkedToActiveCA =
    !!org.linkedCAOrganizationId && org.relationshipStatus === "ACTIVE";

  // ── Legacy / grandfathered ────────────────────────────────
  if (!org.planType) {
    return {
      planType: null,
      effectivePlanType: null,
      category: org.billingCategory,
      status: org.subscriptionStatus,
      isLegacy: true,
      isActive: true,
      lapsed: false,
      features: new Set(allFeatures()),
      aiEnabled: true,
      customerLimit: null,
      invoiceLimit: null,
      userLimit: null,
      clientLimit: null,
      teamLimit: null,
      graceLimit: org.graceLimit,
      hardClientCeiling: null,
      activeClientCount: org.activeClientCount,
      remainingClients: null,
      withinClientLimit: true,
      linkedToActiveCA,
    };
  }

  const plan = getPlan(org.planType);
  const isFree = plan.priceMonthly === 0;
  // The Free plan is always live; paid plans require an active status.
  const active = isFree || ACTIVE_STATUSES.has(org.subscriptionStatus);
  const lapsed = !active;

  // Resolve the *effective* tier after status/floor handling. A lapsed
  // paid plan degrades to the Free floor (data preserved, premium locked).
  const effectivePlanType: ActivePlanType = active ? plan.type : "FREE";
  const effPlan = PLAN_CATALOG[effectivePlanType];
  const features = effPlan.features;

  const clientLimit = effPlan.clientLimit;
  const teamLimit = effPlan.teamLimit;
  const hardClientCeiling =
    clientLimit === null ? null : clientLimit + org.graceLimit;
  const withinClientLimit =
    hardClientCeiling === null ? true : org.activeClientCount <= hardClientCeiling;
  const remainingClients =
    hardClientCeiling === null
      ? null
      : Math.max(0, hardClientCeiling - org.activeClientCount);

  return {
    planType: org.planType,
    effectivePlanType,
    category: org.billingCategory,
    status: org.subscriptionStatus,
    isLegacy: false,
    isActive: active,
    lapsed,
    features: new Set(features),
    aiEnabled: effPlan.ai,
    customerLimit: effPlan.customerLimit,
    invoiceLimit: effPlan.invoiceLimit,
    userLimit: effPlan.teamLimit,
    clientLimit,
    teamLimit,
    graceLimit: org.graceLimit,
    hardClientCeiling,
    activeClientCount: org.activeClientCount,
    remainingClients,
    withinClientLimit,
    linkedToActiveCA,
  };
}

/** JSON-safe shape (Set → array) for API responses and RSC → client props. */
export type EntitlementsDTO = Omit<Entitlements, "features"> & {
  features: Feature[];
};

export function toEntitlementsDTO(ent: Entitlements): EntitlementsDTO {
  return { ...ent, features: [...ent.features] };
}

/** True if the org may use `feature` (legacy orgs always can). */
export function hasFeature(ent: Entitlements, feature: Feature): boolean {
  return ent.isLegacy || ent.features.has(feature);
}

/** Feature check against a serialized DTO (client-side). */
export function dtoHasFeature(ent: EntitlementsDTO, feature: Feature): boolean {
  return ent.isLegacy || ent.features.includes(feature);
}

/** Whether the CA org can take on one more active client. */
export function canAddClient(ent: Entitlements): boolean {
  if (ent.hardClientCeiling === null) return true; // unlimited
  return ent.activeClientCount < ent.hardClientCeiling;
}

/** Whether the CA org can add one more team member, given the current count. */
export function canAddTeamMember(
  ent: Entitlements,
  currentTeamCount: number
): boolean {
  if (ent.teamLimit === null) return true; // unlimited
  return currentTeamCount < ent.teamLimit;
}

/**
 * Generic "within limit" check for a count-based resource. Returns true
 * when there is room for one more (limit null = unlimited).
 */
export function withinCount(limit: number | null, currentCount: number): boolean {
  if (limit === null) return true;
  return currentCount < limit;
}

/**
 * Whether an org has a live, activated subscription. Used to gate
 * dashboard access until a plan is chosen + (for paid plans) paid for.
 * A null planType (plan not yet selected) is NOT activated, even though
 * such an org is treated as legacy-unlocked for feature checks.
 */
export function isActivated(org: OrgPlanFields): boolean {
  if (!org.planType) return false;
  return getEntitlements(org).isActive;
}
