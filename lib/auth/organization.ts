import { getCurrentUser } from "./session";
import { resolveWorkspaceTenant } from "@/lib/workspace/context";

/**
 * Active organizationId for the current request.
 * Honors the Client Workspace override: when a CA has a valid
 * workspace session, the impersonated client org is returned.
 */
export async function getOrganizationId() {
  const workspaceOrgId = await resolveWorkspaceTenant();
  if (workspaceOrgId) return workspaceOrgId;

  const user = await getCurrentUser();
  return user.organizationId;
}

export async function withOrganization<T>(
  callback: (organizationId: string) => Promise<T>
) {
  const organizationId = await getOrganizationId();

  return callback(organizationId);
}