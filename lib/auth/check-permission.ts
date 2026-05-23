import { getCurrentUser } from "./session";
import { rolePermissions } from "./permissions";

export async function hasPermission(permission: string) {
  const user = await getCurrentUser();

  const permissions = rolePermissions[user.role];

  if (permissions.includes("*")) {
    return true;
  }

  return permissions.includes(permission);
}