// ============================================================
// Unit tests — lib/billing/plans.ts
//
// Locks the UNIVERSAL pricing catalog to the product spec: prices,
// limits, the AI flag, and the capability set each tier grants. Also
// verifies legacy plan types map onto the active tiers. If a price or
// feature drifts from the spec these fail loudly.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  PLAN_CATALOG,
  getActivePlans,
  plansForCategory,
  getPlan,
  isFreePlan,
  formatPrice,
  PLAN_ORDER,
  ALL_PLAN_TYPES,
} from "@/lib/billing/plans";
import { FEATURES } from "@/lib/billing/features";

describe("universal catalog tiers", () => {
  it("Free — ₹0, base limits, no AI", () => {
    const p = PLAN_CATALOG.FREE;
    expect(p.priceMonthly).toBe(0);
    expect(p.customerLimit).toBe(50);
    expect(p.invoiceLimit).toBe(25);
    expect(p.teamLimit).toBe(2);
    expect(p.ai).toBe(false);
    expect(p.features).toContain(FEATURES.DASHBOARD);
    expect(p.features).not.toContain(FEATURES.AI);
    expect(p.features).not.toContain(FEATURES.INTEGRATIONS);
  });

  it("Starter — ₹499, larger limits, team workflows, still no AI", () => {
    const p = PLAN_CATALOG.STARTER;
    expect(p.priceMonthly).toBe(499);
    expect(p.customerLimit).toBe(500);
    expect(p.teamLimit).toBe(5);
    expect(p.ai).toBe(false);
    expect(p.features).toEqual(
      expect.arrayContaining([FEATURES.TEAM_WORKFLOWS, FEATURES.APPROVAL_WORKFLOWS, FEATURES.AUDIT_TRAIL])
    );
    expect(p.features).not.toContain(FEATURES.AI);
  });

  it("Growth — ₹1,499, AI + integrations, recommended", () => {
    const p = PLAN_CATALOG.GROWTH;
    expect(p.priceMonthly).toBe(1499);
    expect(p.ai).toBe(true);
    expect(p.recommended).toBe(true);
    expect(p.features).toEqual(
      expect.arrayContaining([
        FEATURES.AI,
        FEATURES.AI_INSIGHTS,
        FEATURES.CASH_FLOW_FORECASTING,
        FEATURES.INTEGRATIONS,
        FEATURES.TALLY_INTEGRATION,
        FEATURES.ZOHO_INTEGRATION,
      ])
    );
  });

  it("Enterprise — ₹3,999, unlimited, white-label + API", () => {
    const p = PLAN_CATALOG.ENTERPRISE;
    expect(p.priceMonthly).toBe(3999);
    expect(p.customerLimit).toBeNull();
    expect(p.invoiceLimit).toBeNull();
    expect(p.teamLimit).toBeNull();
    expect(p.clientLimit).toBeNull();
    expect(p.ai).toBe(true);
    expect(p.features).toEqual(
      expect.arrayContaining([
        FEATURES.MULTI_BRANCH,
        FEATURES.WHITE_LABEL,
        FEATURES.API_ACCESS,
        FEATURES.DEDICATED_ACCOUNT_MANAGER,
      ])
    );
  });
});

describe("catalog helpers", () => {
  it("getActivePlans returns the four tiers in display order", () => {
    expect(getActivePlans().map((p) => p.type)).toEqual(PLAN_ORDER);
    expect(ALL_PLAN_TYPES).toEqual(["FREE", "STARTER", "GROWTH", "ENTERPRISE"]);
  });

  it("plansForCategory is a universal alias (ignores category)", () => {
    expect(plansForCategory().map((p) => p.type)).toEqual(PLAN_ORDER);
  });

  it("classifies free vs paid", () => {
    expect(isFreePlan("FREE")).toBe(true);
    expect(isFreePlan("STARTER")).toBe(false);
    expect(isFreePlan("ENTERPRISE")).toBe(false);
  });

  it("each plan's type key matches its definition", () => {
    for (const [key, def] of Object.entries(PLAN_CATALOG)) {
      expect(def.type).toBe(key);
    }
  });

  it("formats INR prices", () => {
    expect(formatPrice(1499)).toBe("₹1,499");
    expect(formatPrice(0)).toBe("₹0");
  });
});

describe("legacy plan mapping", () => {
  it("maps old CA tiers onto active tiers", () => {
    expect(getPlan("SOLO").type).toBe("FREE");
    expect(getPlan("GROWING_PRACTICE").type).toBe("GROWTH");
    expect(getPlan("FIRM").type).toBe("ENTERPRISE");
  });

  it("maps old business tiers onto active tiers", () => {
    expect(getPlan("CONNECTED").type).toBe("FREE");
    expect(getPlan("CONNECTED_PLUS").type).toBe("STARTER");
    expect(getPlan("STANDALONE").type).toBe("GROWTH");
  });

  it("isFreePlan resolves through the legacy map", () => {
    expect(isFreePlan("SOLO")).toBe(true);
    expect(isFreePlan("CONNECTED")).toBe(true);
    expect(isFreePlan("CONNECTED_PLUS")).toBe(false);
  });
});
