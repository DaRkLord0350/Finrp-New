// ============================================================
// lib/auth/middleware.ts
// Reusable API route guards.
//
// requireAuth()          — provision-or-read; safe for all routes
// requireAuthReadOnly()  — read-only; throws 401 if user not provisioned yet
//                          Use in high-traffic routes where provisioning
//                          must not be triggered (analytics, dashboards, etc.)
//
// Usage:
//   const { user, organizationId } = await requireAuth();
//   await requirePermission("invoices.write");
//   await requireRole(["OWNER", "ADMIN"]);
// ============================================================

import { NextResponse } from "next/server";
import { getCurrentUser, readCurrentUser } from "./session";
import { canFromList } from "./rbac";
import { resolvePermissions } from "./permission-resolver";
import { resolveWorkspaceTenant, getWorkspaceContext } from "@/lib/workspace/context";
import { assertWorkspaceWritable, KycRequiredError } from "@/lib/kyc/guards";
import { Role } from "@prisma/client";

export type AuthGuardOptions = {
  /**
   * Module 10 — throws a 403 (with kycStatus + readOnly) unless the org's
   * KYC is APPROVED (grandfathered orgs with no KycProfile row always
   * pass). Opt-in only, mirrors requireTenant()'s `requireKyc` option in
   * lib/auth/require-tenant.ts — deliberately NOT applied to existing
   * routes in Phase 1. See docs/TBX_FOUNDATION.md §13 Risk 5.
   */
  requireKyc?: boolean;
};

async function checkKyc(organizationId: string, opts?: AuthGuardOptions) {
  if (!opts?.requireKyc) return;
  try {
    await assertWorkspaceWritable(organizationId);
  } catch (err) {
    if (err instanceof KycRequiredError) {
      throw NextResponse.json(
        { error: err.message, kycStatus: err.kycStatus, readOnly: true },
        { status: err.status }
      );
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// requireAuth
// Returns the current user + their organizationId.
// Auto-provisions if the user is not yet in DB (race-safe).
// Throws a 401 NextResponse if not authenticated.
// ---------------------------------------------------------------------------
export async function requireAuth(opts?: AuthGuardOptions) {
  let user: Awaited<ReturnType<typeof getCurrentUser>>;
  let organizationId: string;
  try {
    user = await getCurrentUser();
    // Client Workspace override — CA acting on behalf of an assigned client
    const workspaceOrgId = await resolveWorkspaceTenant();
    organizationId = workspaceOrgId ?? user.organizationId;
  } catch {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await checkKyc(organizationId, opts);
  return { user, organizationId };
}

// ---------------------------------------------------------------------------
// requireAuthReadOnly
// Read-only variant — never creates data.
// Use in layouts, high-throughput API routes, and analytics endpoints
// where triggering provisioning would be unexpected or wasteful.
// Returns 401 if the user is not yet in DB (they must complete onboarding).
// ---------------------------------------------------------------------------
export async function requireAuthReadOnly() {
  try {
    const user = await readCurrentUser();
    if (!user) throw new Error("not provisioned");
    // Client Workspace override — CA acting on behalf of an assigned client
    const workspaceOrgId = await resolveWorkspaceTenant();
    return { user, organizationId: workspaceOrgId ?? user.organizationId };
  } catch {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// ---------------------------------------------------------------------------
// requirePermission
// Throws a 403 NextResponse if the current user lacks the permission.
// ---------------------------------------------------------------------------
export async function requirePermission(permission: string, opts?: AuthGuardOptions) {
  const { user, organizationId } = await requireAuth(opts);

  // A CA inside a Client Workspace is not a member of the client's org —
  // the customer-team RBAC matrix doesn't apply to them. Their
  // ClientAssignment (enforced via resolveWorkspaceTenant()'s route
  // permission gate) is the only relevant authorization.
  if (await getWorkspaceContext()) return { user, organizationId };

  // Effective permissions: custom-role overrides for the user's home org,
  // falling back to the static matrix.
  const permissions = await resolvePermissions(user.organizationId, user.role);

  if (!canFromList(permissions, permission)) {
    throw NextResponse.json(
      { error: `Forbidden — requires permission: ${permission}` },
      { status: 403 }
    );
  }

  return { user, organizationId };
}

// ---------------------------------------------------------------------------
// requireRole
// Throws a 403 NextResponse if the current user's role is not in the list.
// ---------------------------------------------------------------------------
export async function requireRole(roles: Role[]) {
  const { user, organizationId } = await requireAuth();

  // Same impersonation bypass as requirePermission() — see comment above.
  if (await getWorkspaceContext()) return { user, organizationId };

  if (!roles.includes(user.role)) {
    throw NextResponse.json(
      { error: `Forbidden — requires role: ${roles.join(" | ")}` },
      { status: 403 }
    );
  }

  return { user, organizationId };
}

// ---------------------------------------------------------------------------
// withAuth — higher-order wrapper for API handlers
// Catches thrown NextResponse errors and returns them.
//
// Usage:
//   export const GET = withAuth(async (req, { user, organizationId }) => {
//     return NextResponse.json({ ... });
//   }, "invoices.read");
// ---------------------------------------------------------------------------
type AuthContext  = { user: Awaited<ReturnType<typeof getCurrentUser>>; organizationId: string };
type AuthHandler = (req: Request, ctx: AuthContext) => Promise<NextResponse>;

export function withAuth(handler: AuthHandler, permission?: string) {
  return async (req: Request): Promise<NextResponse> => {
    try {
      const ctx = permission
        ? await requirePermission(permission)
        : await requireAuth();
      return handler(req, ctx);
    } catch (err) {
      if (err instanceof NextResponse) return err;
      console.error("[withAuth]", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
