// ============================================================
// lib/ca/permissions.ts
//
// Virtual Access — the 5-tier governance layer that the CA portal
// presents, mapped onto the existing ClientPermission[] system that
// actually enforces impersonation (lib/workspace/*). A tier is the
// human-facing access level; the permission set it expands to is
// what gets written onto the ClientAssignment row and validated on
// every impersonated request.
// ============================================================

import type { CAWorkspaceAccessTier, ClientPermission } from "@prisma/client";

// Tier → concrete ClientPermission set (drives ClientAssignment).
// MANAGE_CONSENTS (create/revoke bank consents) is FULL_ACCESS only.
const TIER_PERMISSIONS: Record<CAWorkspaceAccessTier, ClientPermission[]> = {
  READ_ONLY: ["VIEW_DASHBOARD"],
  READ_WRITE: [
    "VIEW_DASHBOARD",
    "MANAGE_BANKING",
    "MANAGE_GST",
    "MANAGE_TDS",
    "MANAGE_DOCUMENTS",
    "MANAGE_PAYROLL",
  ],
  ACCOUNTING_ONLY: ["VIEW_DASHBOARD", "MANAGE_BANKING", "MANAGE_PAYROLL"],
  COMPLIANCE_ONLY: ["VIEW_DASHBOARD", "MANAGE_GST", "MANAGE_TDS", "MANAGE_DOCUMENTS"],
  FULL_ACCESS: [
    "VIEW_DASHBOARD",
    "MANAGE_BANKING",
    "MANAGE_GST",
    "MANAGE_TDS",
    "MANAGE_DOCUMENTS",
    "MANAGE_PAYROLL",
    "MANAGE_CONSENTS",
  ],
};

export const ALL_TIERS: CAWorkspaceAccessTier[] = [
  "READ_ONLY",
  "ACCOUNTING_ONLY",
  "COMPLIANCE_ONLY",
  "READ_WRITE",
  "FULL_ACCESS",
];

export const TIER_LABELS: Record<CAWorkspaceAccessTier, string> = {
  READ_ONLY: "Read Only",
  READ_WRITE: "Read & Write",
  ACCOUNTING_ONLY: "Accounting Only",
  COMPLIANCE_ONLY: "Compliance Only",
  FULL_ACCESS: "Full Access",
};

export const TIER_DESCRIPTIONS: Record<CAWorkspaceAccessTier, string> = {
  READ_ONLY: "View the client dashboard. No changes.",
  READ_WRITE: "Manage banking, GST, TDS, payroll and documents.",
  ACCOUNTING_ONLY: "Banking and payroll only.",
  COMPLIANCE_ONLY: "GST, TDS and document filings only.",
  FULL_ACCESS: "Everything, including bank consent management.",
};

export const TIER_COLORS: Record<CAWorkspaceAccessTier, string> = {
  READ_ONLY: "#94a3b8",
  READ_WRITE: "#6366f1",
  ACCOUNTING_ONLY: "#0ea5e9",
  COMPLIANCE_ONLY: "#f59e0b",
  FULL_ACCESS: "#10b981",
};

/** Expand a tier into the ClientPermission set stored on ClientAssignment. */
export function tierToClientPermissions(tier: CAWorkspaceAccessTier): ClientPermission[] {
  return [...TIER_PERMISSIONS[tier]];
}

/**
 * Best-effort reverse mapping: find the tier whose permission set
 * exactly matches `perms`, else the closest (largest subset). Used to
 * display the tier for a pre-existing ClientAssignment that was created
 * outside the portal.
 */
export function tierFromClientPermissions(perms: ClientPermission[]): CAWorkspaceAccessTier {
  const set = new Set(perms);
  for (const tier of ALL_TIERS) {
    const t = TIER_PERMISSIONS[tier];
    if (t.length === set.size && t.every((p) => set.has(p))) return tier;
  }
  // Fallback: pick the tier with the most overlap that the perms fully cover.
  let best: CAWorkspaceAccessTier = "READ_ONLY";
  let bestScore = -1;
  for (const tier of ALL_TIERS) {
    const t = TIER_PERMISSIONS[tier];
    const covered = t.every((p) => set.has(p));
    if (covered && t.length > bestScore) {
      bestScore = t.length;
      best = tier;
    }
  }
  return best;
}
