// ============================================================
// lib/billing/plans.ts
//
// THE PLAN CATALOG — single source of truth for the FinRP pricing
// model. One UNIVERSAL four-tier catalog (Free / Starter / Growth /
// Enterprise) applies to every organization, whether it is a CA firm
// or a business. Every price, limit, capability set and marketing
// bullet is defined here exactly once. Entitlements
// (lib/billing/entitlements.ts), the pricing page, the admin analytics
// and the subscription service all read from this catalog — never
// hard-code a price or limit elsewhere. To change pricing or limits,
// edit THIS file (code-as-config).
//
// CLIENT-SAFE: type-only Prisma imports + plain data, so client
// components (pricing cards, settings) can import it directly.
// ============================================================

import type { PlanType } from "@prisma/client";
import { FEATURES, type Feature } from "./features";

// Re-export so callers can type-narrow plan inputs without importing Prisma.
export type { PlanType };

/** The four active plan tiers (legacy enum values are mapped onto these). */
export type ActivePlanType = "FREE" | "STARTER" | "GROWTH" | "ENTERPRISE";

export interface PlanDefinition {
  type: ActivePlanType;
  name: string;
  tagline: string;
  /** Monthly price in INR rupees (0 = free). */
  priceMonthly: number;
  currency: "INR";
  // ── Configurable limits (null = unlimited) ──────────────────
  /** CRM customers an org may create. */
  customerLimit: number | null;
  /** Invoices an org may create. */
  invoiceLimit: number | null;
  /** Team members / users in the org. */
  teamLimit: number | null;
  /** CA firms: max active managed clients. */
  clientLimit: number | null;
  /** AI features (insights, forecasting) included. */
  ai: boolean;
  /** Highlight the card on the pricing page. */
  recommended?: boolean;
  /** Capability set granted by the plan — the org's entitlements. */
  features: Feature[];
  /** Marketing bullet list rendered on the pricing card. */
  highlights: string[];
}

const F = FEATURES;

// Base capabilities every plan includes.
const BASE_FEATURES: Feature[] = [
  F.DASHBOARD,
  F.CLIENT_MANAGEMENT,
  F.COMPLIANCE_TRACKING,
  F.DOCUMENT_COLLECTION,
  F.CLIENT_PORTAL,
  F.FILING_STATUS,
  F.SECURE_DOCUMENT_SHARING,
  F.CA_COMMUNICATION,
];

// Starter adds team workflows + reporting.
const STARTER_FEATURES: Feature[] = [
  ...BASE_FEATURES,
  F.TEAM_ALLOCATION,
  F.APPROVAL_WORKFLOWS,
  F.AUDIT_TRAIL,
  F.TEAM_WORKFLOWS,
  F.SELF_MANAGED_COMPLIANCE,
  F.INVESTOR_REPORTS,
];

// Growth adds AI + integrations + automation.
const GROWTH_FEATURES: Feature[] = [
  ...STARTER_FEATURES,
  F.AI,
  F.AI_INSIGHTS,
  F.CASH_FLOW_FORECASTING,
  F.INTEGRATIONS,
  F.TALLY_INTEGRATION,
  F.ZOHO_INTEGRATION,
  F.M1XCHANGE_INTEGRATION,
  F.COMPLIANCE_AUTOMATION,
  F.MULTI_ENTITY,
  F.PRIORITY_SUPPORT,
];

// Enterprise adds scale + control.
const ENTERPRISE_FEATURES: Feature[] = [
  ...GROWTH_FEATURES,
  F.MULTI_BRANCH,
  F.WHITE_LABEL,
  F.API_ACCESS,
  F.DEDICATED_ACCOUNT_MANAGER,
];

export const PLAN_CATALOG: Record<ActivePlanType, PlanDefinition> = {
  FREE: {
    type: "FREE",
    name: "Free",
    tagline: "Everything you need to get started — no card required.",
    priceMonthly: 0,
    currency: "INR",
    customerLimit: 50,
    invoiceLimit: 25,
    teamLimit: 2,
    clientLimit: 5,
    ai: false,
    features: BASE_FEATURES,
    highlights: [
      "Up to 50 customers",
      "Up to 25 invoices",
      "2 team members",
      "Compliance tracking",
      "Document collection",
      "Secure document sharing",
    ],
  },
  STARTER: {
    type: "STARTER",
    name: "Starter",
    tagline: "For growing teams that need more room and workflows.",
    priceMonthly: 499,
    currency: "INR",
    customerLimit: 500,
    invoiceLimit: 250,
    teamLimit: 5,
    clientLimit: 25,
    ai: false,
    features: STARTER_FEATURES,
    highlights: [
      "Everything in Free",
      "Up to 500 customers",
      "Up to 250 invoices",
      "5 team members",
      "Team allocation & workflows",
      "Approval workflows + audit trail",
    ],
  },
  GROWTH: {
    type: "GROWTH",
    name: "Growth",
    tagline: "AI, integrations, and automation to scale your operations.",
    priceMonthly: 1499,
    currency: "INR",
    customerLimit: 5000,
    invoiceLimit: 2500,
    teamLimit: 20,
    clientLimit: 150,
    ai: true,
    recommended: true,
    features: GROWTH_FEATURES,
    highlights: [
      "Everything in Starter",
      "Up to 5,000 customers",
      "Up to 2,500 invoices",
      "20 team members",
      "AI insights & cash-flow forecasting",
      "All integrations (Tally, Zoho, M1xchange)",
      "Compliance automation + priority support",
    ],
  },
  ENTERPRISE: {
    type: "ENTERPRISE",
    name: "Enterprise",
    tagline: "Unlimited scale with white-label, API access and a dedicated manager.",
    priceMonthly: 3999,
    currency: "INR",
    customerLimit: null,
    invoiceLimit: null,
    teamLimit: null,
    clientLimit: null,
    ai: true,
    features: ENTERPRISE_FEATURES,
    highlights: [
      "Everything in Growth",
      "Unlimited customers & invoices",
      "Unlimited team members",
      "Multi-branch + white-label portal",
      "API access",
      "Dedicated account manager",
    ],
  },
};

// ── Order + legacy mapping ──────────────────────────────────

/** Display order for the four active plans. */
export const PLAN_ORDER: ActivePlanType[] = ["FREE", "STARTER", "GROWTH", "ENTERPRISE"];

/** Only the active plan types are assignable through the catalog/UI. */
export const ALL_PLAN_TYPES: PlanType[] = [...PLAN_ORDER];

/**
 * Map any legacy `PlanType` value (from the previous CA/Business split)
 * onto the nearest active tier so old rows never crash. New writes only
 * ever use the four active types.
 */
const LEGACY_PLAN_MAP: Partial<Record<PlanType, ActivePlanType>> = {
  // CA tiers
  SOLO: "FREE",
  GROWING_PRACTICE: "GROWTH",
  FIRM: "ENTERPRISE",
  // Business tiers
  CONNECTED: "FREE",
  CONNECTED_PLUS: "STARTER",
  STANDALONE: "GROWTH",
};

/** Resolve a `PlanType` (active or legacy) to its plan definition. */
export function getPlan(planType: PlanType): PlanDefinition {
  return (
    PLAN_CATALOG[planType as ActivePlanType] ??
    PLAN_CATALOG[LEGACY_PLAN_MAP[planType] ?? "FREE"]
  );
}

/** The four active plans, in display order. */
export function getActivePlans(): PlanDefinition[] {
  return PLAN_ORDER.map((t) => PLAN_CATALOG[t]);
}

/**
 * Backward-compatible alias — the catalog is now universal, so the
 * category argument is ignored and the four active plans are returned.
 */
export function plansForCategory(): PlanDefinition[] {
  return getActivePlans();
}

export function isFreePlan(planType: PlanType): boolean {
  return getPlan(planType).priceMonthly === 0;
}

/** Format a monthly price in the Indian locale, e.g. "₹1,499". */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
