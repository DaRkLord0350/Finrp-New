// ============================================================
// lib/client-portal/auth.ts
//
// RBAC helpers for the Client Portal API routes (requirement 7).
// Builds a PortalActor from the Clerk-authenticated user and resolves
// the firm-org tenancy for each role:
//   • CA / CA_FIRM_ADMIN / ADMIN → operate in their own firm org
//   • CUSTOMER                   → bridged to their firm org + customerId
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { resolvePortalClient, type PortalClientContext } from "./context";
import type { PortalActor } from "./service";

const FIRM_ROLES = ["CA", "CA_FIRM_ADMIN", "ADMIN"];

function toActor(user: {
  id: string;
  organizationId: string;
  firmId: string | null;
  name: string | null;
  email: string;
  userRole: string | null;
}): PortalActor {
  return {
    id: user.id,
    organizationId: user.organizationId,
    firmId: user.firmId,
    name: user.name,
    email: user.email,
    userRole: user.userRole,
  };
}

/** Any authenticated user as a PortalActor, or null. */
export async function getPortalActor(): Promise<PortalActor | null> {
  try {
    return toActor(await getCurrentUser());
  } catch {
    return null;
  }
}

/** CA, firm admin, or platform admin — operating in their firm org. */
export async function requireFirmSide(): Promise<PortalActor | null> {
  const actor = await getPortalActor();
  if (!actor || !actor.userRole || !FIRM_ROLES.includes(actor.userRole)) return null;
  return actor;
}

/** A logged-in customer, bridged to their firm org + Customer record. */
export async function requireCustomer(): Promise<
  { actor: PortalActor; ctx: PortalClientContext } | null
> {
  const actor = await getPortalActor();
  if (!actor) return null;
  const ctx = await resolvePortalClient({
    id: actor.id,
    email: actor.email,
    organizationId: actor.organizationId,
    firmId: actor.firmId,
    userRole: actor.userRole,
  });
  if (!ctx) return null;
  return { actor, ctx };
}
