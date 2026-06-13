// ============================================================
// FinRP Banking OS — Consent Management Guard
// Consent creation/revocation and account disconnection are
// OWNER actions. A CA working inside a client workspace may only
// perform them when the ClientAssignment explicitly grants
// MANAGE_CONSENTS (never part of the default permission set).
//
// Returns the tenant + acting user for the route, or a ready
// 401/403 response. Used by:
//   POST   /api/banking/setu/connect
//   DELETE /api/banking/consents/[id]
//   (any future disconnect endpoints)
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getTenantId } from "@/lib/auth/tenant";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { readCurrentUser } from "@/lib/auth/session";

export type ConsentAccessResult =
  | { ok: true; organizationId: string; userId: string | null; viaWorkspace: boolean }
  | { ok: false; response: NextResponse };

export async function requireConsentManagementAccess(): Promise<ConsentAccessResult> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  // CA impersonating a client? Allowed only with the explicit grant.
  const workspace = await getWorkspaceContext();
  if (workspace && !workspace.isSuperAdmin && !workspace.permissions.includes("MANAGE_CONSENTS")) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Consent management requires an explicit MANAGE_CONSENTS grant from the client" },
        { status: 403 }
      ),
    };
  }

  const organizationId = await getTenantId();
  if (!organizationId) {
    return { ok: false, response: NextResponse.json({ error: "No organization" }, { status: 400 }) };
  }

  const user = await readCurrentUser();
  return {
    ok: true,
    organizationId,
    userId: user?.id ?? null,
    viaWorkspace: workspace !== null,
  };
}
