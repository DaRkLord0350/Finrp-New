// ============================================================
// lib/auth/pageGuard.ts
// Server-side page authorization guard.
// Use in page files to protect pages based on permissions.
// ============================================================

import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";
import { hasPermission } from "./access";

/**
 * Protect a page with permission check.
 * Redirects to /unauthorized if user lacks permission.
 *
 * Usage (in page.tsx):
 *   export default async function Page() {
 *     await requirePagePermission("finance.read");
 *     return <FinancePage />;
 *   }
 */
export async function requirePagePermission(
  permission: string,
  redirectPath: string = "/unauthorized"
) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const allowed = await hasPermission(permission);

  if (!allowed) {
    redirect(redirectPath);
  }

  return user;
}

/**
 * Protect a page with role check.
 * Redirects to /unauthorized if user doesn't have required role.
 *
 * Usage:
 *   export default async function Page() {
 *     await requirePageRole(["ADMIN", "CA"]);
 *     return <AdminPage />;
 *   }
 */
export async function requirePageRole(
  roles: string[],
  redirectPath: string = "/unauthorized"
) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!roles.includes(user.role)) {
    redirect(redirectPath);
  }

  return user;
}

/**
 * Protect a page with any of multiple permissions.
 * Redirects to /unauthorized if user lacks all specified permissions.
 *
 * Usage:
 *   export default async function Page() {
 *     await requirePageAnyPermission(["invoices.approve", "compliance.approve"]);
 *     return <ApprovalPage />;
 *   }
 */
export async function requirePageAnyPermission(
  permissions: string[],
  redirectPath: string = "/unauthorized"
) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Check if user has at least one of the permissions
  let hasAccess = false;

  for (const permission of permissions) {
    if (await hasPermission(permission)) {
      hasAccess = true;
      break;
    }
  }

  if (!hasAccess) {
    redirect(redirectPath);
  }

  return user;
}

/**
 * Protect a page with all required permissions.
 * Redirects to /unauthorized if user lacks any of the specified permissions.
 *
 * Usage:
 *   export default async function Page() {
 *     await requirePageAllPermissions(["invoices.write", "invoices.approve"]);
 *     return <AdvancedInvoicePage />;
 *   }
 */
export async function requirePageAllPermissions(
  permissions: string[],
  redirectPath: string = "/unauthorized"
) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Check if user has all permissions
  for (const permission of permissions) {
    const hasAccess = await hasPermission(permission);
    if (!hasAccess) {
      redirect(redirectPath);
    }
  }

  return user;
}
