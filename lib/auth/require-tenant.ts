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
import { getTenantId } from "@/lib/auth/tenant";

export type TenantContext = {
  userId: string;
  organizationId: string;
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
 * Authenticate the current request and resolve the organizationId.
 * Throws UnauthorizedError when not authenticated or tenant not found.
 * Use inside API route handlers.
 */
export async function requireTenant(): Promise<TenantContext> {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();

  const organizationId = await getTenantId();
  if (!organizationId) throw new UnauthorizedError("Organization not found");

  return { userId, organizationId };
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
  handler: (req: Request, ctx: TenantContext) => Promise<NextResponse>
) {
  return async function (req: Request): Promise<NextResponse> {
    try {
      const ctx = await requireTenant();
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return NextResponse.json({ error: err.message }, { status: 401 });
      }
      if (err instanceof ForbiddenError) {
        return NextResponse.json({ error: err.message }, { status: 403 });
      }
      console.error("[withTenant]", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
