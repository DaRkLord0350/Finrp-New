// ============================================================
// lib/auth/index.ts — barrel export for auth utilities
// ============================================================

export { getCurrentUser, getOptionalUser } from "./session";
export { getOrganizationId, withOrganization } from "./organization";
export { hasPermission } from "./check-permission";
export { requireAuth, requirePermission, requireRole, withAuth } from "./middleware";
export { rolePermissions } from "./permissions";
export {
  hasModuleAccess,
  hasActionPermission,
  can,
  permissionsFor,
  hasModuleAccessFromList,
  hasActionPermissionFromList,
  canFromList,
  canView,
  canCreate,
  canEdit,
  canDelete,
  getModuleMatrix,
  crudToPermissions,
  ALL_MODULES,
  type AppModule,
  type Action,
  type CrudActions,
} from "./rbac";
export { guardModule, requireModuleAccess } from "./require-module";
export { joinOrganizationFromInvite } from "./invitations";
export {
  resolvePermissions,
  invalidatePermissionsCache,
} from "./permission-resolver";
