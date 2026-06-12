// ============================================================
// lib/workspace/context.ts
//
// Server-side workspace (impersonation) context.
//
// getWorkspaceContext()
//   Reads + fully validates the workspace cookie:
//     1. HMAC signature + expiry          (token.ts)
//     2. Cookie is bound to THIS Clerk user
//     3. DB user still exists, role is CA/CA_FIRM_ADMIN/ADMIN
//     4. Active ClientAssignment (Redis-cached, 60s)
//   Returns null on any failure — callers silently fall back to
//   the user's own organization, so a revoked assignment or an
//   expired session can never leak client data.
//
// resolveWorkspaceTenant()
//   The single hook called by getTenantId() / requireAuth() /
//   getOrganizationId(). On top of getWorkspaceContext() it:
//     • enforces the route → ClientPermission map (x-ws-path
//       header injected by the root middleware)
//     • audit-logs every API mutation (POST/PUT/PATCH/DELETE)
//       and every permission denial — exactly once per request
//       (React cache() memoizes per request).
//
// Both functions are no-ops outside a request scope (workers,
// scripts): cookies()/headers() throw there and we return null.
// ============================================================

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { readCurrentUser } from "@/lib/auth/session";
import { WORKSPACE_COOKIE, verifyWorkspaceToken } from "./token";
import { resolveWorkspaceAccess } from "./assignments";
import { requiredPermissionForPath, hasWorkspacePermission } from "./permissions";
import { logClientActivity, mutationActionForMethod, entityFromPath } from "./audit";
import type { ClientPermission, UserRole } from "@prisma/client";

export interface WorkspaceContext {
  /** the impersonated client organization */
  organizationId: string;
  /** DB user id of the acting CA */
  caUserId: string;
  clerkId: string;
  role: UserRole;
  permissions: ClientPermission[];
  isSuperAdmin: boolean;
}

// ---------------------------------------------------------------------------
// getWorkspaceContext — request-memoized full validation
// ---------------------------------------------------------------------------
export const getWorkspaceContext = cache(
  async (): Promise<WorkspaceContext | null> => {
    let raw: string | undefined;
    try {
      raw = (await cookies()).get(WORKSPACE_COOKIE)?.value;
    } catch {
      return null; // outside request scope (worker / build)
    }
    if (!raw) return null;

    const payload = await verifyWorkspaceToken(raw);
    if (!payload) return null;

    const { userId: clerkId } = await auth();
    if (!clerkId || clerkId !== payload.cid) return null;

    const user = await readCurrentUser();
    if (!user || user.id !== payload.uid) return null;
    if (!user.userRole || user.userRole === "CUSTOMER") return null;

    const access = await resolveWorkspaceAccess(
      { id: user.id, userRole: user.userRole, firmId: user.firmId },
      payload.orgId
    );
    if (!access.allowed) return null;

    return {
      organizationId: payload.orgId,
      caUserId: user.id,
      clerkId,
      role: user.userRole,
      permissions: access.permissions,
      isSuperAdmin: user.userRole === "ADMIN",
    };
  }
);

// ---------------------------------------------------------------------------
// Request metadata (path/method injected by root middleware,
// IP/UA from standard headers)
// ---------------------------------------------------------------------------
async function getRequestMeta() {
  try {
    const hdrs = await headers();
    return {
      path: hdrs.get("x-ws-path") ?? "",
      method: (hdrs.get("x-ws-method") ?? "GET").toUpperCase(),
      ipAddress: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
      userAgent: hdrs.get("user-agent") ?? undefined,
    };
  } catch {
    return { path: "", method: "GET", ipAddress: undefined, userAgent: undefined };
  }
}

// ---------------------------------------------------------------------------
// resolveWorkspaceTenant — tenant override + permission gate + audit
// ---------------------------------------------------------------------------
export const resolveWorkspaceTenant = cache(
  async (): Promise<string | null> => {
    const ws = await getWorkspaceContext();
    if (!ws) return null;

    const { path, method, ipAddress, userAgent } = await getRequestMeta();

    // Permission gate by route prefix. Denied → audit + fall back to the
    // CA's own org (no client data is served, no 500s on the client).
    const required = requiredPermissionForPath(path);
    if (!hasWorkspacePermission(ws.permissions, required, ws.isSuperAdmin)) {
      logClientActivity({
        caUserId: ws.caUserId,
        organizationId: ws.organizationId,
        action: "PERMISSION_DENIED",
        summary: `Denied ${method} ${path} — missing ${required}`,
        method,
        path,
        ipAddress,
        userAgent,
      });
      return null;
    }

    // Audit every API mutation performed while impersonating.
    if (path.startsWith("/api/")) {
      const action = mutationActionForMethod(method);
      if (action) {
        logClientActivity({
          caUserId: ws.caUserId,
          organizationId: ws.organizationId,
          action,
          summary: `${method} ${path} on behalf of client`,
          method,
          path,
          entity: entityFromPath(path),
          ipAddress,
          userAgent,
        });
      }
    }

    return ws.organizationId;
  }
);
