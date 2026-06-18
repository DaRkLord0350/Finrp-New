"use client";

// ============================================================
// hooks/usePermissions.ts
//
// Client-side accessor for the current user's RBAC role + permissions
// (provided by <PermissionsProvider>). Use it to hide or lock buttons
// and controls the user isn't allowed to use.
//
// UX ONLY — the matching server action / API route must re-check.
// ============================================================

import { usePermissionsContext } from "@/components/auth/PermissionsProvider";
import {
  canFromList,
  hasActionPermissionFromList,
  hasModuleAccessFromList,
  canViewFromList,
  canCreateFromList,
  canEditFromList,
  canDeleteFromList,
  getModuleCrudFromList,
  type Action,
  type AppModule,
} from "@/lib/auth/rbac";

export function usePermissions() {
  const { role, permissions } = usePermissionsContext();

  return {
    role,
    permissions,
    /** raw `<resource>.<action>` string check (supports "*" wildcard) */
    can: (permission: string) => canFromList(permissions, permission),
    /** `<resource>` + `<action>` check */
    canAction: (resource: string, action: Action | string) =>
      hasActionPermissionFromList(permissions, resource, action),
    /** module-level check (mirrors the sidebar / page gate) */
    canModule: (module: AppModule) =>
      hasModuleAccessFromList(permissions, module),
    // ── CRUD-granular checks (module vs action) ──────────────
    canView: (module: AppModule) => canViewFromList(permissions, module),
    canCreate: (module: AppModule) => canCreateFromList(permissions, module),
    canEdit: (module: AppModule) => canEditFromList(permissions, module),
    canDelete: (module: AppModule) => canDeleteFromList(permissions, module),
    moduleCrud: (module: AppModule) => getModuleCrudFromList(permissions, module),
  };
}
