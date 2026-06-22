// ============================================================
// lib/auth/rbac.ts
//
// Centralized RBAC utility — the single helper layer used across
// pages, layouts, server actions, API routes, the sidebar, and the
// client <Can> gate. Reads the matrix from lib/auth/permissions.ts.
//
// CLIENT-SAFE: this module only imports the `Role` TYPE from Prisma
// (erased at build time) plus the plain permission map, so it can be
// imported from client components without pulling in the Prisma
// runtime.
//
//   hasActionPermission(role, resource, action) — fine-grained
//   hasModuleAccess(role, module)               — module-level (sidebar/pages)
//   permissionsFor(role)                        — raw list (for the client provider)
// ============================================================

import type { Role } from "@prisma/client";
import { rolePermissions } from "./permissions";

// ── App modules (sidebar + page-level access) ─────────────────
export type AppModule =
  | "dashboard"
  | "crm"
  | "billing"
  | "finance"
  | "accounting"
  | "erp"
  | "inventory"
  | "compliance"
  | "tax"
  | "payroll"
  | "banking"
  | "reports"
  | "settings"
  | "users";

export type Action =
  | "read"
  | "write"
  | "delete"
  | "export"
  | "approve"
  | "manage";

// Resource prefixes that count as "inside" a module. A role has
// access to the module if it holds ANY permission for one of these
// resources (e.g. "customers.read" → crm).
const MODULE_RESOURCES: Record<AppModule, string[]> = {
  dashboard: ["dashboard"],
  crm: ["customers", "leads"],
  billing: ["invoices", "payments"],
  finance: ["finance", "accounting", "loans"],
  accounting: ["accounting"],
  erp: ["erp"],
  inventory: ["inventory", "items"],
  compliance: ["compliance"],
  tax: ["tax"],
  payroll: ["payroll", "employees"],
  banking: ["banking"],
  reports: ["analytics"],
  settings: ["settings"],
  users: ["users"],
};

const WILDCARD = "*";

/** Raw permission strings granted to a role (["*"] for OWNER). */
export function permissionsFor(role: Role | null | undefined): string[] {
  if (!role) return [];
  return rolePermissions[role] ?? [];
}

/** True if the role can perform `<resource>.<action>`. */
export function hasActionPermission(
  role: Role | null | undefined,
  resource: string,
  action: Action | string
): boolean {
  const perms = permissionsFor(role);
  if (perms.includes(WILDCARD)) return true;
  return perms.includes(`${resource}.${action}`);
}

/** True if a raw permission string is granted (supports the "*" wildcard). */
export function can(
  role: Role | null | undefined,
  permission: string
): boolean {
  const perms = permissionsFor(role);
  if (perms.includes(WILDCARD)) return true;
  return perms.includes(permission);
}

/**
 * True if the role has ANY permission for the given module.
 * Used to build the dynamic sidebar and to gate page loads.
 */
export function hasModuleAccess(
  role: Role | null | undefined,
  module: AppModule
): boolean {
  const perms = permissionsFor(role);
  if (perms.includes(WILDCARD)) return true;

  const prefixes = MODULE_RESOURCES[module] ?? [module];
  return perms.some((p) =>
    prefixes.some((pre) => p === pre || p.startsWith(`${pre}.`))
  );
}

// ── Client-side variants ──────────────────────────────────────
// The client provider ships the resolved permission list (not the
// role), so these mirror the role-based helpers against a flat list.

export function canFromList(permissions: string[], permission: string): boolean {
  return permissions.includes(WILDCARD) || permissions.includes(permission);
}

export function hasActionPermissionFromList(
  permissions: string[],
  resource: string,
  action: Action | string
): boolean {
  return canFromList(permissions, `${resource}.${action}`);
}

export function hasModuleAccessFromList(
  permissions: string[],
  module: AppModule
): boolean {
  if (permissions.includes(WILDCARD)) return true;
  const prefixes = MODULE_RESOURCES[module] ?? [module];
  return permissions.some((p) =>
    prefixes.some((pre) => p === pre || p.startsWith(`${pre}.`))
  );
}

// ============================================================
// Module-vs-action (CRUD) view of the matrix
//
// Separates *module access* (can the role see the module at all)
// from *action permissions* (view / create / edit / delete) so UIs
// and the future custom-role table can reason at CRUD granularity.
// Derived from the same `<resource>.<action>` strings — no second
// source of truth. Mapping: view⇐.read, create/edit⇐.write, delete⇐.delete.
// ============================================================

export interface CrudActions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

function moduleHasAction(
  permissions: string[],
  module: AppModule,
  action: "read" | "write" | "delete"
): boolean {
  if (permissions.includes(WILDCARD)) return true;
  const resources = MODULE_RESOURCES[module] ?? [module];
  return resources.some((r) => permissions.includes(`${r}.${action}`));
}

// ── List-based (client / resolved permissions) ────────────────
export function canViewFromList(permissions: string[], module: AppModule): boolean {
  // "view" = any read OR any write/delete (acting implies viewing).
  return (
    moduleHasAction(permissions, module, "read") ||
    moduleHasAction(permissions, module, "write") ||
    moduleHasAction(permissions, module, "delete")
  );
}
export function canCreateFromList(permissions: string[], module: AppModule): boolean {
  return moduleHasAction(permissions, module, "write");
}
export function canEditFromList(permissions: string[], module: AppModule): boolean {
  return moduleHasAction(permissions, module, "write");
}
export function canDeleteFromList(permissions: string[], module: AppModule): boolean {
  return moduleHasAction(permissions, module, "delete");
}
export function getModuleCrudFromList(
  permissions: string[],
  module: AppModule
): CrudActions {
  return {
    view: canViewFromList(permissions, module),
    create: canCreateFromList(permissions, module),
    edit: canEditFromList(permissions, module),
    delete: canDeleteFromList(permissions, module),
  };
}

// ── Role-based (static matrix) ────────────────────────────────
export function canView(role: Role | null | undefined, module: AppModule): boolean {
  return canViewFromList(permissionsFor(role), module);
}
export function canCreate(role: Role | null | undefined, module: AppModule): boolean {
  return canCreateFromList(permissionsFor(role), module);
}
export function canEdit(role: Role | null | undefined, module: AppModule): boolean {
  return canEditFromList(permissionsFor(role), module);
}
export function canDelete(role: Role | null | undefined, module: AppModule): boolean {
  return canDeleteFromList(permissionsFor(role), module);
}

export const ALL_MODULES: AppModule[] = Object.keys(MODULE_RESOURCES) as AppModule[];

/** The full CRUD matrix for a role — handy for settings UIs and tests. */
export function getModuleMatrix(
  role: Role | null | undefined
): Record<AppModule, CrudActions> {
  const perms = permissionsFor(role);
  const out = {} as Record<AppModule, CrudActions>;
  for (const m of ALL_MODULES) out[m] = getModuleCrudFromList(perms, m);
  return out;
}

/**
 * Expand a module's CRUD flags into concrete `<resource>.<action>`
 * permission strings for EVERY resource in that module. Used by the
 * custom-role resolver to turn RolePermission rows back into the flat
 * permission list the rest of the system already understands.
 */
export function crudToPermissions(module: AppModule, crud: CrudActions): string[] {
  const resources = MODULE_RESOURCES[module] ?? [module];
  const perms: string[] = [];
  for (const r of resources) {
    if (crud.view) perms.push(`${r}.read`);
    if (crud.create || crud.edit) perms.push(`${r}.write`);
    if (crud.delete) perms.push(`${r}.delete`);
  }
  return perms;
}
