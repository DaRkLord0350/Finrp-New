// ============================================================
// lib/auth/index.ts — barrel export for auth utilities
// ============================================================

export { getCurrentUser, getOptionalUser } from "./session";
export { getOrganizationId, withOrganization } from "./organization";
export { hasPermission } from "./check-permission";
export { requireAuth, requirePermission, requireRole, withAuth } from "./middleware";
export { rolePermissions } from "./permissions";

// New access control exports
export {
  hasAllPermissions,
  hasAnyPermission,
  hasRole,
  hasAnyRole,
  getUserPermissions,
  getUserRole,
  isSuperAdmin,
  isAdmin,
  isCA,
  canManageUsers,
  canApprove,
  canExportReports,
  canAccessFinance,
  canAccessCompliance,
  canModifyCompliance,
  canApproveCompliance,
} from "./access";

// Page guard exports
export {
  requirePagePermission,
  requirePageRole,
  requirePageAnyPermission,
  requirePageAllPermissions,
} from "./pageGuard";

// Sidebar filtering exports
export {
  getVisibleSidebarItems,
  getVisibleSidebarGroups,
  canAccessSidebarItem,
  canAccessAnySidebarItem,
} from "./sidebar";
