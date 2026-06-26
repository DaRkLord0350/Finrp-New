import { getCurrentUser } from "./session";
import { canFromList } from "./rbac";
import { resolvePermissions } from "./permission-resolver";
import { getWorkspaceContext } from "@/lib/workspace/context";

export async function hasPermission(permission: string) {
  // A CA inside a Client Workspace is not a member of the client's org —
  // the customer-team RBAC matrix doesn't apply to them (see require-module.tsx).
  if (await getWorkspaceContext()) return true;

  const user = await getCurrentUser();

  // Effective permissions (custom-role overrides → static defaults).
  const permissions = await resolvePermissions(user.organizationId, user.role);

  return canFromList(permissions, permission);
}