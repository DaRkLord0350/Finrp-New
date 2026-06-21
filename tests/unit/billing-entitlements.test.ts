// ============================================================
// Unit tests — lib/billing/entitlements.ts
//
// Covers the universal-catalog feature gating + plan-limit math: per-tier
// limits (customers / invoices / users / clients), the AI flag, lapsed
// paid plans flooring to Free, and activation gating. Pure invariants
// that every guard and the UI rely on.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  getEntitlements,
  hasFeature,
  canAddClient,
  canAddTeamMember,
  withinCount,
  isActivated,
  type OrgPlanFields,
} from "@/lib/billing/entitlements";
import { FEATURES } from "@/lib/billing/features";
import type { PlanType, SubscriptionStatus } from "@prisma/client";

function org(p: Partial<OrgPlanFields> = {}): OrgPlanFields {
  return {
    billingCategory: null,
    planType: null,
    subscriptionStatus: "ACTIVE" as SubscriptionStatus,
    clientLimit: null,
    teamLimit: null,
    activeClientCount: 0,
    graceLimit: 0,
    relationshipStatus: null,
    linkedCAOrganizationId: null,
    ...p,
  };
}
function ent(planType: PlanType, extra: Partial<OrgPlanFields> = {}) {
  return getEntitlements(org({ billingCategory: "BUSINESS", planType, ...extra }));
}

describe("legacy / grandfathered orgs", () => {
  it("an org with no planType is fully unlocked with no limits", () => {
    const e = getEntitlements(org());
    expect(e.isLegacy).toBe(true);
    expect(hasFeature(e, FEATURES.AI)).toBe(true);
    expect(hasFeature(e, FEATURES.WHITE_LABEL)).toBe(true);
    expect(e.customerLimit).toBeNull();
    expect(e.invoiceLimit).toBeNull();
    expect(e.aiEnabled).toBe(true);
  });
});

describe("Free tier", () => {
  it("exposes base limits and no AI", () => {
    const e = ent("FREE");
    expect(e.isActive).toBe(true);
    expect(e.customerLimit).toBe(50);
    expect(e.invoiceLimit).toBe(25);
    expect(e.userLimit).toBe(2);
    expect(e.aiEnabled).toBe(false);
    expect(hasFeature(e, FEATURES.AI)).toBe(false);
    expect(hasFeature(e, FEATURES.INTEGRATIONS)).toBe(false);
    expect(hasFeature(e, FEATURES.DASHBOARD)).toBe(true);
  });
});

describe("Starter tier", () => {
  it("raises limits, adds team workflows, still no AI", () => {
    const e = ent("STARTER");
    expect(e.customerLimit).toBe(500);
    expect(e.userLimit).toBe(5);
    expect(e.aiEnabled).toBe(false);
    expect(hasFeature(e, FEATURES.TEAM_WORKFLOWS)).toBe(true);
    expect(hasFeature(e, FEATURES.AI)).toBe(false);
  });
});

describe("Growth tier", () => {
  it("enables AI + integrations", () => {
    const e = ent("GROWTH");
    expect(e.aiEnabled).toBe(true);
    expect(hasFeature(e, FEATURES.AI)).toBe(true);
    expect(hasFeature(e, FEATURES.INTEGRATIONS)).toBe(true);
    expect(hasFeature(e, FEATURES.TALLY_INTEGRATION)).toBe(true);
  });
});

describe("Enterprise tier", () => {
  it("is unlimited with white-label + API", () => {
    const e = ent("ENTERPRISE", { activeClientCount: 10_000 });
    expect(e.customerLimit).toBeNull();
    expect(e.userLimit).toBeNull();
    expect(e.clientLimit).toBeNull();
    expect(canAddClient(e)).toBe(true);
    expect(canAddTeamMember(e, 999)).toBe(true);
    expect(hasFeature(e, FEATURES.WHITE_LABEL)).toBe(true);
    expect(hasFeature(e, FEATURES.API_ACCESS)).toBe(true);
  });
});

describe("lapsed paid plans floor to Free", () => {
  it("a past-due Growth degrades to Free features/limits", () => {
    const e = ent("GROWTH", { subscriptionStatus: "PAST_DUE" });
    expect(e.lapsed).toBe(true);
    expect(e.effectivePlanType).toBe("FREE");
    expect(e.customerLimit).toBe(50);
    expect(hasFeature(e, FEATURES.AI)).toBe(false);
    expect(hasFeature(e, FEATURES.DASHBOARD)).toBe(true);
  });

  it("a canceled Starter floors to Free (data preserved, premium locked)", () => {
    const e = ent("STARTER", { subscriptionStatus: "CANCELED" });
    expect(e.effectivePlanType).toBe("FREE");
    expect(hasFeature(e, FEATURES.TEAM_WORKFLOWS)).toBe(false);
    expect(hasFeature(e, FEATURES.DASHBOARD)).toBe(true);
  });
});

describe("legacy plan rows resolve onto active tiers", () => {
  it("a SOLO org behaves like Free", () => {
    const e = ent("SOLO");
    expect(e.effectivePlanType).toBe("FREE");
    expect(e.customerLimit).toBe(50);
  });
  it("a STANDALONE org behaves like Growth (AI enabled)", () => {
    const e = ent("STANDALONE");
    expect(e.effectivePlanType).toBe("GROWTH");
    expect(hasFeature(e, FEATURES.AI)).toBe(true);
  });
});

describe("activation gating (isActivated)", () => {
  it("a plan-less org is NOT activated (must choose a plan)", () => {
    expect(isActivated(org({ billingCategory: "BUSINESS" }))).toBe(false);
  });
  it("the Free plan is activated immediately", () => {
    expect(isActivated(org({ billingCategory: "BUSINESS", planType: "FREE" }))).toBe(true);
  });
  it("a paid plan awaiting payment (INACTIVE) is NOT activated", () => {
    expect(
      isActivated(org({ billingCategory: "BUSINESS", planType: "GROWTH", subscriptionStatus: "INACTIVE" }))
    ).toBe(false);
  });
  it("a paid plan that is ACTIVE is activated", () => {
    expect(
      isActivated(org({ billingCategory: "BUSINESS", planType: "GROWTH", subscriptionStatus: "ACTIVE" }))
    ).toBe(true);
  });
});

describe("CA client-limit math", () => {
  it("computes remaining slots including grace (Free = 5 clients)", () => {
    const e = ent("FREE", { activeClientCount: 3, graceLimit: 2 });
    // ceiling = 5 + 2 = 7; remaining = 4
    expect(e.clientLimit).toBe(5);
    expect(e.hardClientCeiling).toBe(7);
    expect(e.remainingClients).toBe(4);
    expect(e.withinClientLimit).toBe(true);
  });
  it("blocks new clients at the ceiling", () => {
    expect(canAddClient(ent("FREE", { activeClientCount: 5 }))).toBe(false);
    expect(canAddClient(ent("GROWTH", { activeClientCount: 5 }))).toBe(true);
  });
});

describe("withinCount helper", () => {
  it("treats null as unlimited", () => {
    expect(withinCount(null, 10_000)).toBe(true);
  });
  it("allows up to but not at the limit", () => {
    expect(withinCount(2, 1)).toBe(true);
    expect(withinCount(2, 2)).toBe(false);
    expect(withinCount(2, 3)).toBe(false);
  });
});
