// ============================================================
// lib/auth/access.ts
// Access control helper functions for permission checking.
// Use this library for consistent permission validation.
// ============================================================

import { Role } from "@prisma/client";
import { getCurrentUser } from "./session";
import { rolePermissions } from "./permissions";

/**
 * Check if current user has a specific permission.
 * 
 * Usage:
 *   const allowed = await hasPermission("invoices.write");
 *   if (!allowed) return redirect("/unauthorized");
 */
export async function hasPermission(permission: string): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    const permissions = rolePermissions[user.role];

    // SUPER_ADMIN has wildcard access
    if (permissions.includes("*")) {
      return true;
    }

    return permissions.includes(permission);
  } catch {
    return false;
  }
}

/**
 * Check if current user has all specified permissions.
 * 
 * Usage:
 *   const allowed = await hasAllPermissions(["invoices.write", "invoices.approve"]);
 */
export async function hasAllPermissions(permissions: string[]): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    const userPerms = rolePermissions[user.role];

    // SUPER_ADMIN has wildcard access
    if (userPerms.includes("*")) {
      return true;
    }

    return permissions.every((perm) => userPerms.includes(perm));
  } catch {
    return false;
  }
}

/**
 * Check if current user has any of the specified permissions.
 * 
 * Usage:
 *   const allowed = await hasAnyPermission(["invoices.approve", "compliance.approve"]);
 */
export async function hasAnyPermission(permissions: string[]): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    const userPerms = rolePermissions[user.role];

    // SUPER_ADMIN has wildcard access
    if (userPerms.includes("*")) {
      return true;
    }

    return permissions.some((perm) => userPerms.includes(perm));
  } catch {
    return false;
  }
}

/**
 * Check if current user has a specific role.
 * 
 * Usage:
 *   const isAdmin = await hasRole(["ADMIN", "SUPER_ADMIN"]);
 */
export async function hasRole(roles: Role[]): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    return roles.includes(user.role);
  } catch {
    return false;
  }
}

/**
 * Check if current user has any of the specified roles.
 * Alias for hasRole() for consistency.
 */
export async function hasAnyRole(roles: Role[]): Promise<boolean> {
  return hasRole(roles);
}

/**
 * Get all permissions for current user's role.
 * 
 * Usage:
 *   const perms = await getUserPermissions();
 *   console.log(perms); // ["dashboard.read", "invoices.write", ...]
 */
export async function getUserPermissions(): Promise<string[]> {
  try {
    const user = await getCurrentUser();
    return rolePermissions[user.role];
  } catch {
    return [];
  }
}

/**
 * Get current user's role.
 * 
 * Usage:
 *   const role = await getUserRole();
 */
export async function getUserRole(): Promise<Role | null> {
  try {
    const user = await getCurrentUser();
    return user.role;
  } catch {
    return null;
  }
}

/**
 * Check if user is SUPER_ADMIN (platform level).
 */
export async function isSuperAdmin(): Promise<boolean> {
  return hasRole(["SUPER_ADMIN"]);
}

/**
 * Check if user is ADMIN (organization level).
 */
export async function isAdmin(): Promise<boolean> {
  return hasRole(["ADMIN"]);
}

/**
 * Check if user is CA (Chartered Accountant).
 */
export async function isCA(): Promise<boolean> {
  return hasRole(["CA"]);
}

/**
 * Check if user can manage users (only SUPER_ADMIN and ADMIN).
 */
export async function canManageUsers(): Promise<boolean> {
  return hasPermission("users.write");
}

/**
 * Check if user can approve invoices or compliance items.
 */
export async function canApprove(): Promise<boolean> {
  return hasAnyPermission(["invoices.approve", "compliance.approve"]);
}

/**
 * Check if user can export reports.
 */
export async function canExportReports(): Promise<boolean> {
  return hasPermission("reports.export");
}

/**
 * Check if user can access finance module.
 */
export async function canAccessFinance(): Promise<boolean> {
  return hasPermission("finance.read");
}

/**
 * Check if user can access compliance module.
 */
export async function canAccessCompliance(): Promise<boolean> {
  return hasPermission("compliance.read");
}

/**
 * Check if user can modify compliance (not just read).
 */
export async function canModifyCompliance(): Promise<boolean> {
  return hasPermission("compliance.write");
}

/**
 * Check if user can approve compliance items.
 */
export async function canApproveCompliance(): Promise<boolean> {
  return hasPermission("compliance.approve");
}
