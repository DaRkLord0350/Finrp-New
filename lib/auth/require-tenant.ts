// ============================================================
// requireTenant — production-grade API route guard
//
// Combines Clerk auth + DB tenant lookup in a single call.
// Throws structured errors so route handlers stay thin.
//
// Usage:
//   export async function GET(req: Request) {
//     const { userId, organizationId } = await requireTenant();
//     // ... safe to use organizationId
//   }
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { getTenantId } from "@/lib/auth/tenant";
import { readCurrentUser } from "@/lib/auth/session";
import { canFromList } from "@/lib/auth/rbac";
import { resolvePermissions } from "@/lib/auth/permission-resolver";
import {
  getOrgEntitlements,
  FeatureLockedError,
  PlanLimitError,
} from "@/lib/billing/guards";
import { hasFeature } from "@/lib/billing/entitlements";
import type { Feature } from "@/lib/billing/features";

export type TenantContext = {
  userId: string;
  organizationId: string;
  /** The authenticated user's RBAC role (OWNER..VIEWER). */
  role: Role;
};

export type RequireTenantOptions = {
  /** When set, throws ForbiddenError (HTTP 403) unless the role grants it. */
  permission?: string;
  /** When set, throws FeatureLockedError (HTTP 402) unless the plan grants it. */
  feature?: Feature;
};

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Authenticate the current request and resolve the organizationId + role.
 * Throws UnauthorizedError when not authenticated or tenant not found,
 * ForbiddenError when the account is deactivated or lacks `opts.permission`.
 *
 * Pass `{ permission }` to enforce RBAC in one line — every protected
 * API route should verify permissions independently of the UI.
 *
 * @example
 *   const { organizationId } = await requireTenant({ permission: "customers.write" });
 */
export async function requireTenant(
  opts?: RequireTenantOptions
): Promise<TenantContext> {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();

  // Read-only fetch (never provisions) — gives us role + active state.
  const dbUser = await readCurrentUser();
  if (!dbUser) throw new UnauthorizedError("Organization not found");
  if (!dbUser.isActive) throw new ForbiddenError("Account is deactivated");

  // Honors the Client Workspace (CA impersonation) tenant override.
  const organizationId = await getTenantId();
  if (!organizationId) throw new UnauthorizedError("Organization not found");

  if (opts?.permission) {
    // Resolve against the user's HOME org so custom-role overrides apply.
    const perms = await resolvePermissions(dbUser.organizationId, dbUser.role);
    if (!canFromList(perms, opts.permission)) {
      throw new ForbiddenError(
        `Forbidden — requires permission: ${opts.permission}`
      );
    }
  }

  if (opts?.feature) {
    // Enforce the plan entitlement against the EFFECTIVE tenant (so an
    // impersonating CA is gated by the client org being served).
    const ent = await getOrgEntitlements(organizationId);
    if (!hasFeature(ent, opts.feature)) {
      throw new FeatureLockedError(opts.feature);
    }
  }

  return { userId, organizationId, role: dbUser.role };
}

/**
 * Wrap a route handler with automatic auth + error serialisation.
 *
 * Before: 8 lines of boilerplate per route.
 * After:  the handler only contains business logic.
 *
 * @example
 * export const GET = withTenant(async (_req, { organizationId }) => {
 *   const data = await customerRepository.list(organizationId);
 *   return NextResponse.json(data);
 * });
 */
export function withTenant(
  handler: (req: Request, ctx: TenantContext) => Promise<NextResponse>,
  opts?: RequireTenantOptions
) {
  return async function (req: Request): Promise<NextResponse> {
    try {
      const ctx = await requireTenant(opts);
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return NextResponse.json({ error: err.message }, { status: 401 });
      }
      if (err instanceof ForbiddenError) {
        return NextResponse.json({ error: err.message }, { status: 403 });
      }
      if (err instanceof FeatureLockedError) {
        return NextResponse.json(
          { error: err.message, feature: err.feature, upgradeRequired: true },
          { status: 402 }
        );
      }
      if (err instanceof PlanLimitError) {
        return NextResponse.json(
          { error: err.message, upgradeRequired: true },
          { status: 402 }
        );
      }
      console.error("[withTenant]", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
