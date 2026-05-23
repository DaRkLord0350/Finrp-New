import { getCurrentUser } from "./session";

export async function getOrganizationId() {
  const user = await getCurrentUser();

  return user.organizationId;
}

export async function withOrganization<T>(
  callback: (organizationId: string) => Promise<T>
) {
  const organizationId = await getOrganizationId();

  return callback(organizationId);
}