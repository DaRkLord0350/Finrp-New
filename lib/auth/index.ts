// ============================================================
// lib/auth/index.ts — barrel export for auth utilities
// ============================================================

export { getCurrentUser, getOptionalUser } from "./session";
export { getOrganizationId, withOrganization } from "./organization";
export { hasPermission } from "./check-permission";
export { requireAuth, requirePermission, requireRole, withAuth } from "./middleware";
export { rolePermissions } from "./permissions";
