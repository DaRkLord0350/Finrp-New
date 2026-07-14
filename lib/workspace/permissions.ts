// ============================================================
// lib/workspace/permissions.ts
//
// Client Workspace RBAC — permission constants and the
// route-prefix → required-permission map used to gate both
// workspace navigation (Sidebar) and API access (tenant
// resolution in lib/workspace/context.ts).
//
// Permissions mirror the Prisma `ClientPermission` enum so the
// same values are stored on ClientAssignment rows and checked
// at request time.
// ============================================================

import type { ClientPermission } from "@prisma/client";

export const WORKSPACE_PERMISSIONS: ClientPermission[] = [
  "VIEW_DASHBOARD",
  "MANAGE_BANKING",
  "MANAGE_GST",
  "MANAGE_TDS",
  "MANAGE_DOCUMENTS",
  "MANAGE_PAYROLL",
  "MANAGE_CONSENTS",
  "MANAGE_KYC",
];

export const PERMISSION_LABELS: Record<ClientPermission, string> = {
  VIEW_DASHBOARD:   "Dashboard",
  MANAGE_BANKING:   "Banking",
  MANAGE_GST:       "GST",
  MANAGE_TDS:       "TDS",
  MANAGE_DOCUMENTS: "Documents",
  MANAGE_PAYROLL:   "Payroll",
  // Explicit grant only — never in ClientAssignment defaults. Lets a CA
  // create/revoke AA consents and disconnect bank accounts for the client.
  MANAGE_CONSENTS:  "Bank Consents",
  // Explicit grant only — never in ClientAssignment defaults. Lets a CA
  // complete/edit the client's TBX KYC onboarding wizard on their behalf.
  MANAGE_KYC:       "KYC Onboarding",
};

// ---------------------------------------------------------------------------
// Route → permission map.
// Most-specific prefixes MUST come first — the first match wins.
// Routes not listed here (CRM, billing, reports, ERP sales/purchases/
// expenses, compliance) only require a valid workspace session.
// ---------------------------------------------------------------------------
const ROUTE_PERMISSIONS: ReadonlyArray<{ prefix: string; permission: ClientPermission }> = [
  // ── Pages ──────────────────────────────────────────────────
  { prefix: "/banking/gst-match",     permission: "MANAGE_GST" },
  { prefix: "/banking/gst-reconcile", permission: "MANAGE_GST" },
  { prefix: "/banking",               permission: "MANAGE_BANKING" },
  { prefix: "/erp/payroll",           permission: "MANAGE_PAYROLL" },
  { prefix: "/tds",                   permission: "MANAGE_TDS" },
  { prefix: "/customer/documents",    permission: "MANAGE_DOCUMENTS" },
  { prefix: "/onboarding/kyc",        permission: "MANAGE_KYC" },
  { prefix: "/dashboard",             permission: "VIEW_DASHBOARD" },

  // ── APIs ───────────────────────────────────────────────────
  { prefix: "/api/banking/gst",       permission: "MANAGE_GST" },
  { prefix: "/api/banking",           permission: "MANAGE_BANKING" },
  { prefix: "/api/transactions",      permission: "MANAGE_BANKING" },
  { prefix: "/api/transfers",         permission: "MANAGE_BANKING" },
  { prefix: "/api/erp/payroll",       permission: "MANAGE_PAYROLL" },
  { prefix: "/api/documents",         permission: "MANAGE_DOCUMENTS" },
  { prefix: "/api/onboarding/kyc",    permission: "MANAGE_KYC" },
  { prefix: "/api/dashboard",         permission: "VIEW_DASHBOARD" },
];

/**
 * Returns the ClientPermission required to access the given path,
 * or null when the path is open to any valid workspace session.
 */
export function requiredPermissionForPath(path: string): ClientPermission | null {
  const clean = path.split("?")[0];
  for (const rule of ROUTE_PERMISSIONS) {
    if (clean === rule.prefix || clean.startsWith(rule.prefix + "/")) {
      return rule.permission;
    }
  }
  return null;
}

export function hasWorkspacePermission(
  permissions: ClientPermission[],
  required: ClientPermission | null,
  isSuperAdmin = false
): boolean {
  if (!required || isSuperAdmin) return true;
  return permissions.includes(required);
}

/**
 * First workspace route the CA is allowed to land on. Used when a
 * permission gate bounces them off a page so we never redirect into
 * another gated route (e.g. /dashboard without VIEW_DASHBOARD).
 */
export function workspaceHomeFor(
  permissions: ClientPermission[],
  isSuperAdmin = false
): string {
  if (isSuperAdmin || permissions.includes("VIEW_DASHBOARD")) return "/dashboard";
  if (permissions.includes("MANAGE_BANKING")) return "/banking/dashboard";
  if (permissions.includes("MANAGE_GST")) return "/banking/gst-match";
  if (permissions.includes("MANAGE_TDS")) return "/tds";
  if (permissions.includes("MANAGE_PAYROLL")) return "/erp/payroll";
  if (permissions.includes("MANAGE_DOCUMENTS")) return "/customer/documents";
  return "/reports"; // reports are open to any valid workspace session
}
