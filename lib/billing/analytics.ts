// ============================================================
// lib/billing/analytics.ts
//
// Platform-wide subscription analytics for the admin console. All
// figures derive from the live org/relationship rows + the universal
// plan catalog — no figures are hard-coded.
// ============================================================

import { prisma } from "@/lib/prisma";
import { getPlan, PLAN_ORDER, type ActivePlanType } from "./plans";
import type { PlanType } from "@prisma/client";

export interface RevenueRow {
  planType: ActivePlanType;
  subscribers: number;
  mrr: number;
}

export interface CaUtilizationRow {
  id: string;
  name: string;
  planType: PlanType | null;
  active: number;
  limit: number | null;
  pct: number | null; // null = unlimited
}

export interface SubscriptionAnalytics {
  planCounts: Record<ActivePlanType, number>;
  activePaidCounts: Record<ActivePlanType, number>;
  revenueByPlan: RevenueRow[];
  totalMRR: number;
  paidSubscribers: number;
  freeOrgs: number;
  caSubscriptions: number;
  businessSubscriptions: number;
  connectedBusinesses: number;
  totalActiveClients: number;
  relationshipsByStatus: Record<string, number>;
  caUtilization: CaUtilizationRow[];
  avgCaUtilization: number | null;
  upgradeOpportunities: {
    freeOrgs: number;
    freeNearCustomerLimit: number;
  };
}

function zeroPlanRecord(): Record<ActivePlanType, number> {
  return PLAN_ORDER.reduce(
    (acc, t) => ({ ...acc, [t]: 0 }),
    {} as Record<ActivePlanType, number>
  );
}

/** Normalise any (possibly legacy) plan type onto its active tier. */
function activeTierOf(planType: PlanType): ActivePlanType {
  return getPlan(planType).type;
}

export async function getSubscriptionAnalytics(): Promise<SubscriptionAnalytics> {
  const [
    planCountRows,
    activePaidRows,
    caOrgs,
    relationshipStatusRows,
    activeClientCount,
    caSubscriptions,
    businessSubscriptions,
  ] = await Promise.all([
    prisma.organization.groupBy({
      by: ["planType"],
      where: { planType: { not: null } },
      _count: { _all: true },
    }),
    prisma.organization.groupBy({
      by: ["planType"],
      where: { planType: { not: null }, subscriptionStatus: { in: ["ACTIVE", "TRIALING"] } },
      _count: { _all: true },
    }),
    prisma.organization.findMany({
      where: { billingCategory: "CA" },
      select: { id: true, name: true, planType: true, activeClientCount: true, clientLimit: true },
      orderBy: { activeClientCount: "desc" },
    }),
    prisma.cARelationship.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.cARelationship.count({ where: { status: "ACTIVE" } }),
    prisma.organization.count({ where: { billingCategory: "CA" } }),
    prisma.organization.count({ where: { billingCategory: "BUSINESS" } }),
  ]);

  // Plan counts, normalised onto the four active tiers.
  const planCounts = zeroPlanRecord();
  for (const row of planCountRows) {
    if (row.planType) planCounts[activeTierOf(row.planType)] += row._count._all;
  }

  const activePaidCounts = zeroPlanRecord();
  for (const row of activePaidRows) {
    if (row.planType) activePaidCounts[activeTierOf(row.planType)] += row._count._all;
  }

  // Revenue: paid tiers only, counting active/trialing subscribers.
  const revenueByPlan: RevenueRow[] = PLAN_ORDER.filter(
    (t) => getPlan(t).priceMonthly > 0
  ).map((t) => {
    const subscribers = activePaidCounts[t];
    return { planType: t, subscribers, mrr: subscribers * getPlan(t).priceMonthly };
  });
  const totalMRR = revenueByPlan.reduce((sum, r) => sum + r.mrr, 0);
  const paidSubscribers = revenueByPlan.reduce((sum, r) => sum + r.subscribers, 0);
  const freeOrgs = planCounts.FREE;

  // CA utilisation.
  const caUtilization: CaUtilizationRow[] = caOrgs.map((o) => {
    const limit = o.clientLimit;
    const pct = limit && limit > 0 ? Math.round((o.activeClientCount / limit) * 100) : null;
    return { id: o.id, name: o.name, planType: o.planType, active: o.activeClientCount, limit, pct };
  });
  const withPct = caUtilization.filter((c) => c.pct !== null) as Array<CaUtilizationRow & { pct: number }>;
  const avgCaUtilization =
    withPct.length > 0
      ? Math.round(withPct.reduce((s, c) => s + c.pct, 0) / withPct.length)
      : null;

  const relationshipsByStatus: Record<string, number> = {};
  for (const row of relationshipStatusRows) {
    relationshipsByStatus[row.status] = row._count._all;
  }

  // Upgrade opportunities: Free orgs nearing the customer cap.
  const freeCustomerLimit = getPlan("FREE").customerLimit ?? 50;
  const freeNearThreshold = Math.ceil(freeCustomerLimit * 0.8);
  const freeOrgIds = await prisma.organization.findMany({
    where: { planType: "FREE" },
    select: { id: true, _count: { select: { customers: true } } },
  });
  const freeNearCustomerLimit = freeOrgIds.filter(
    (o) => o._count.customers >= freeNearThreshold
  ).length;

  return {
    planCounts,
    activePaidCounts,
    revenueByPlan,
    totalMRR,
    paidSubscribers,
    freeOrgs,
    caSubscriptions,
    businessSubscriptions,
    connectedBusinesses: activeClientCount,
    totalActiveClients: activeClientCount,
    relationshipsByStatus,
    caUtilization,
    avgCaUtilization,
    upgradeOpportunities: {
      freeOrgs,
      freeNearCustomerLimit,
    },
  };
}
