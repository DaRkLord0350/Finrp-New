// ============================================================
// lib/auth/require-module.tsx
//
// Server-side page/layout guard. Pages are gated by MODULE so the
// matrix lives in one place (lib/auth/rbac.ts → permissions.ts).
//
//   // In a server layout/page:
//   const denied = await guardModule("crm");
//   if (denied) return denied;            // renders <AccessDenied/>
//
// API routes use requireTenant({ permission }) instead (HTTP 403).
// ============================================================

import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { hasModuleAccessFromList, type AppModule } from "@/lib/auth/rbac";
import { resolvePermissions } from "@/lib/auth/permission-resolver";
import AccessDenied from "@/components/auth/AccessDenied";

const MODULE_LABELS: Record<AppModule, string> = {
  dashboard: "Dashboard",
  crm: "CRM",
  billing: "Billing",
  finance: "Finance",
  accounting: "Accounting",
  erp: "ERP",
  inventory: "Inventory",
  compliance: "Compliance",
  payroll: "Payroll",
  banking: "Banking",
  reports: "Reports",
  settings: "Settings",
  users: "Users",
};

/**
 * Returns an <AccessDenied/> element when the current user's role
 * cannot access `module`, otherwise `null`. Render the returned node
 * to block the page:
 *
 *   const denied = await guardModule("crm");
 *   if (denied) return denied;
 */
export async function guardModule(module: AppModule): Promise<ReactNode | null> {
  const user = await getCurrentUser();
  const perms = await resolvePermissions(user.organizationId, user.role);
  if (hasModuleAccessFromList(perms, module)) return null;
  return <AccessDenied label={MODULE_LABELS[module]} />;
}

/**
 * Throwing variant for server actions / non-page contexts.
 * Throws a plain Error tagged with status 403.
 */
export async function requireModuleAccess(module: AppModule): Promise<void> {
  const user = await getCurrentUser();
  const perms = await resolvePermissions(user.organizationId, user.role);
  if (!hasModuleAccessFromList(perms, module)) {
    const err = new Error(`Forbidden — requires module: ${module}`) as Error & {
      status?: number;
    };
    err.status = 403;
    throw err;
  }
}
