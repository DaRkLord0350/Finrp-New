// ============================================================
// lib/billing/features.ts
//
// The catalogue of capability flags ("features") that plans grant.
// This is the vocabulary every entitlement check speaks. Keep it
// CLIENT-SAFE — no Prisma runtime imports — so the pricing page and
// client gates can import it freely.
//
// Two kinds of features live here:
//   • Concrete capabilities (e.g. "tally_integration", "white_label").
//   • Umbrella gates the server enforces (AI, INTEGRATIONS) — a single
//     switch a route can check instead of enumerating every sub-feature.
// ============================================================

export const FEATURES = {
  // ── CA practice capabilities ──────────────────────────────
  CLIENT_MANAGEMENT: "client_management",
  COMPLIANCE_TRACKING: "compliance_tracking",
  DOCUMENT_COLLECTION: "document_collection",
  CLIENT_PORTAL: "client_portal",
  TEAM_ALLOCATION: "team_allocation",
  COMPLIANCE_AUTOMATION: "compliance_automation",
  APPROVAL_WORKFLOWS: "approval_workflows",
  AUDIT_TRAIL: "audit_trail",
  TEAM_WORKFLOWS: "team_workflows",
  MULTI_BRANCH: "multi_branch",
  WHITE_LABEL: "white_label",
  API_ACCESS: "api_access",
  DEDICATED_ACCOUNT_MANAGER: "dedicated_account_manager",

  // ── Business capabilities ─────────────────────────────────
  DASHBOARD: "dashboard",
  FILING_STATUS: "filing_status",
  SECURE_DOCUMENT_SHARING: "secure_document_sharing",
  CA_COMMUNICATION: "ca_communication",
  AI_INSIGHTS: "ai_insights",
  CASH_FLOW_FORECASTING: "cash_flow_forecasting",
  TALLY_INTEGRATION: "tally_integration",
  ZOHO_INTEGRATION: "zoho_integration",
  M1XCHANGE_INTEGRATION: "m1xchange_integration",
  INVESTOR_REPORTS: "investor_reports",
  MULTI_ENTITY: "multi_entity",
  SELF_MANAGED_COMPLIANCE: "self_managed_compliance",

  // ── Umbrella gates (checked directly by server guards) ────
  AI: "ai",
  INTEGRATIONS: "integrations",
  PRIORITY_SUPPORT: "priority_support",
} as const;

export type Feature = (typeof FEATURES)[keyof typeof FEATURES];

// Human-readable labels for UI (cards, lock states, settings).
export const FEATURE_LABELS: Record<Feature, string> = {
  client_management: "Client management",
  compliance_tracking: "Compliance tracking",
  document_collection: "Document collection",
  client_portal: "Client portal",
  team_allocation: "Team allocation",
  compliance_automation: "Compliance automation",
  approval_workflows: "Approval workflows",
  audit_trail: "Audit trail",
  team_workflows: "Team workflows",
  multi_branch: "Multi-branch support",
  white_label: "White-label portal",
  api_access: "API access",
  dedicated_account_manager: "Dedicated account management",
  dashboard: "Dashboard",
  filing_status: "Filing status",
  secure_document_sharing: "Secure document sharing",
  ca_communication: "CA communication",
  ai_insights: "AI insights",
  cash_flow_forecasting: "Cash-flow forecasting",
  tally_integration: "Tally integration",
  zoho_integration: "Zoho integration",
  m1xchange_integration: "M1xchange integration",
  investor_reports: "Investor reports",
  multi_entity: "Multi-entity support",
  self_managed_compliance: "Self-managed compliance",
  ai: "AI features",
  integrations: "Integrations",
  priority_support: "Priority support",
};

/**
 * Umbrella gates that route handlers check directly. Each premium
 * sub-feature also implies its umbrella gate inside the plan catalog,
 * so a single `requireFeature(FEATURES.INTEGRATIONS)` protects every
 * integration endpoint.
 */
export const UMBRELLA_GATES: readonly Feature[] = [
  FEATURES.AI,
  FEATURES.INTEGRATIONS,
] as const;
