// ============================================================
// lib/auth/middleware.ts
// Reusable API route guards.
//
// Usage:
//   const { user, organizationId } = await requireAuth();
//   await requirePermission("invoices.write");
//   await requireRole(["OWNER", "ADMIN"]);
// ============================================================

import { NextResponse } from "next/server";
import { getCurrentUser } from "./session";
import { rolePermissions } from "./permissions";
import { Role } from "@prisma/client";

// ---------------------------------------------------------------------------
// requireAuth
// Returns the current user + their organizationId.
// Throws a 401 NextResponse if not authenticated.
// ---------------------------------------------------------------------------
export async function requireAuth() {
  try {
    const user = await getCurrentUser();
    return { user, organizationId: user.organizationId };
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
//     ...
//     return NextResponse.json({ ... });
//   }, "invoices.read");
// ---------------------------------------------------------------------------
type AuthContext = { user: Awaited<ReturnType<typeof getCurrentUser>>; organizationId: string };
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
