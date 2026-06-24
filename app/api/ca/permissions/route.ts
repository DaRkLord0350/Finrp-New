// ============================================================
// /api/ca/permissions
//   POST → set a client's Virtual Access tier.
//
// Writes CAWorkspacePermission (the governance record) and, when the
// client has an onboarded org, upserts the ClientAssignment that the
// existing impersonation system (lib/workspace/*) actually enforces.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCAApi, isAdmin } from "@/lib/ca/api-auth";
import { isCustomerAssignedTo, resolveCustomerOrgId } from "@/lib/ca/portal";
import { tierToClientPermissions } from "@/lib/ca/permissions";
import { invalidateWorkspaceAccess } from "@/lib/workspace/assignments";
import type { CAWorkspaceAccessTier } from "@prisma/client";

const TIERS: CAWorkspaceAccessTier[] = [
  "READ_ONLY", "READ_WRITE", "ACCOUNTING_ONLY", "COMPLIANCE_ONLY", "FULL_ACCESS",
];

export async function POST(req: NextRequest) {
  const user = await requireCAApi();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const customerId = String(body?.customerId ?? "");
  const tier = body?.tier as CAWorkspaceAccessTier;

  if (!customerId) return NextResponse.json({ error: "customerId is required" }, { status: 400 });
  if (!TIERS.includes(tier)) return NextResponse.json({ error: "Invalid tier" }, { status: 400 });

  if (!isAdmin(user) && !(await isCustomerAssignedTo(user.id, customerId))) {
    return NextResponse.json({ error: "You are not assigned to this client" }, { status: 403 });
  }

  const orgId = await resolveCustomerOrgId(customerId);

  await prisma.cAWorkspacePermission.upsert({
    where: { caUserId_customerId: { caUserId: user.id, customerId } },
    create: { caUserId: user.id, customerId, organizationId: orgId, tier, grantedById: user.id, isActive: true },
    update: { tier, organizationId: orgId, isActive: true },
  });

  // Mirror onto ClientAssignment so the impersonation cookie honors it.
  if (orgId) {
    const permissions = tierToClientPermissions(tier);
    await prisma.clientAssignment.upsert({
      where: { caUserId_organizationId: { caUserId: user.id, organizationId: orgId } },
      create: { caUserId: user.id, organizationId: orgId, firmId: user.firmId, permissions, assignedById: user.id, isActive: true },
      update: { permissions, isActive: true, revokedAt: null },
    });
    await invalidateWorkspaceAccess(orgId);
  }

  return NextResponse.json({ ok: true, tier, hasWorkspace: !!orgId });
}
