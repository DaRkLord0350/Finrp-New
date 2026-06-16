// ============================================================
// PATCH /api/firm/team/[id]/permissions
//   Body: { permissions: ClientPermission[], firmRole?: FirmMemberRole }
//   Sets the member's default workspace permissions (applied when
//   they are assigned to a client workspace) and, optionally, their
//   firm designation. Reuses the existing ClientPermission RBAC —
//   no parallel permission system. Users only.
//
// RBAC: CA_FIRM_ADMIN only, scoped to the admin's organization.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { ClientPermission, FirmMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";
import { logTeamActivity, clientIpFrom } from "@/lib/team/activity";
import { WORKSPACE_PERMISSIONS } from "@/lib/workspace/permissions";
import { firmRoleToUserRole, FIRM_MEMBER_ROLES } from "@/lib/team/constants";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: { id, organizationId: admin.organizationId },
  });
  if (!user) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const requested: unknown[] = Array.isArray(body.permissions) ? body.permissions : [];
  const permissions = requested.filter(
    (p): p is ClientPermission =>
      typeof p === "string" && WORKSPACE_PERMISSIONS.includes(p as ClientPermission)
  );

  const data: Prisma.UserUpdateInput = { defaultPermissions: { set: permissions } };

  if (body.firmRole !== undefined) {
    if (!FIRM_MEMBER_ROLES.includes(body.firmRole))
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    const firmRole = body.firmRole as FirmMemberRole;
    data.firmRole = firmRole;
    data.userRole = firmRoleToUserRole(firmRole);
  }

  await prisma.user.update({ where: { id }, data });

  await logTeamActivity({
    organizationId: admin.organizationId,
    actorId: admin.id,
    actorName: admin.name ?? admin.email,
    targetUserId: id,
    targetEmail: user.email,
    action: "PERMISSIONS_UPDATED",
    metadata: { permissions },
    ipAddress: clientIpFrom(req),
  });

  return NextResponse.json({ ok: true, permissions });
}
