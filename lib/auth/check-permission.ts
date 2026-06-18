import { getCurrentUser } from "./session";
import { canFromList } from "./rbac";
import { resolvePermissions } from "./permission-resolver";

export async function hasPermission(permission: string) {
  const user = await getCurrentUser();

  // Effective permissions (custom-role overrides → static defaults).
  const permissions = await resolvePermissions(user.organizationId, user.role);

  return canFromList(permissions, permission);
}