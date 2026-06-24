// ============================================================
// lib/ca/api-auth.ts
//
// Shared guard for CA-portal API routes. Returns the authenticated
// CA user (CA / CA_FIRM_ADMIN / ADMIN) or null. Callers translate
// null into a 401/403. Customer-level scoping is enforced separately
// via isCustomerAssignedTo() so a CA can only act on their clients.
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";

export type CAApiUser = Awaited<ReturnType<typeof getCurrentUser>>;

export async function requireCAApi(): Promise<CAApiUser | null> {
  let user: CAApiUser;
  try {
    user = await getCurrentUser();
  } catch {
    return null;
  }
  if (!user.userRole || user.userRole === "CUSTOMER") return null;
  return user;
}

/** ADMIN may act on any customer; everyone else must be assigned. */
export function isAdmin(user: CAApiUser): boolean {
  return user.userRole === "ADMIN";
}
