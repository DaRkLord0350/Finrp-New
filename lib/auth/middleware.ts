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
import { rolePermissions } from "./permissions";
import { resolveWorkspaceTenant } from "@/lib/workspace/context";
import { Role } from "@prisma/client";

// ---------------------------------------------------------------------------
// requireAuth
// Returns the current user + their organizationId.
// Auto-provisions if the user is not yet in DB (race-safe).
// Throws a 401 NextResponse if not authenticated.
// ---------------------------------------------------------------------------
export async function requireAuth() {
  try {
    const user = await getCurrentUser();
    // Client Workspace override — CA acting on behalf of an assigned client
    const workspaceOrgId = await resolveWorkspaceTenant();
    return { user, organizationId: workspaceOrgId ?? user.organizationId };
  } catch {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
export async function requirePermission(permission: string) {
  const { user, organizationId } = await requireAuth();

  const permissions = rolePermissions[user.role];
  const allowed =
    permissions.includes("*") || permissions.includes(permission);

  if (!allowed) {
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
