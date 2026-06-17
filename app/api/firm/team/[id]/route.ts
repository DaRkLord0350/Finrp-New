// ============================================================
// PATCH /api/firm/team/[id]
//   Edit a team member. `kind` selects the backing record:
//     "user"   → an active/inactive User
//     "invite" → a pending Invitation
//
// RBAC: CA_FIRM_ADMIN only, scoped to the admin's organization.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { FirmMemberRole, Specialization } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";
import { logTeamActivity, clientIpFrom } from "@/lib/team/activity";
import {
  firmRoleToUserRole,
  firmRoleToOrgRole,
  FIRM_MEMBER_ROLES,
  SPECIALIZATIONS,
} from "@/lib/team/constants";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const kind: "user" | "invite" = body.kind === "invite" ? "invite" : "user";

  // ── Parse + validate the (partial) fields ──────────────────
  const name = body.name !== undefined ? String(body.name).trim() : undefined;
  const phone = body.phone !== undefined ? String(body.phone).trim() || null : undefined;

  let firmRole: FirmMemberRole | undefined;
  if (body.firmRole !== undefined) {
    if (!FIRM_MEMBER_ROLES.includes(body.firmRole))
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    firmRole = body.firmRole;
  }

  let specialization: Specialization | null | undefined;
  if (body.specialization !== undefined) {
    if (body.specialization === null || body.specialization === "") {
      specialization = null;
    } else if (!SPECIALIZATIONS.includes(body.specialization)) {
      return NextResponse.json({ error: "Invalid specialization" }, { status: 400 });
    } else {
      specialization = body.specialization;
    }
  }

  let joiningDate: Date | null | undefined;
  if (body.joiningDate !== undefined) {
    joiningDate = body.joiningDate ? new Date(body.joiningDate) : null;
    if (joiningDate && isNaN(joiningDate.getTime()))
      return NextResponse.json({ error: "Invalid joining date" }, { status: 400 });
  }

  if (name !== undefined && !name)
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });

  if (kind === "user") {
    const user = await prisma.user.findFirst({
      where: { id, organizationId: admin.organizationId },
    });
    if (!user) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const data: Prisma.UserUpdateInput = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (firmRole !== undefined) {
      data.firmRole = firmRole;
      data.userRole = firmRoleToUserRole(firmRole);
    }
    if (specialization !== undefined) data.specialization = specialization;
    if (joiningDate !== undefined) data.joiningDate = joiningDate;
    if (body.status !== undefined) {
      data.isActive = body.status === "ACTIVE" || body.status === true;
    }

    await prisma.user.update({ where: { id }, data });

    await logTeamActivity({
      organizationId: admin.organizationId,
      actorId: admin.id,
      actorName: admin.name ?? admin.email,
      targetUserId: id,
      targetEmail: user.email,
      action: "MEMBER_UPDATED",
      metadata: { fields: Object.keys(data) },
      ipAddress: clientIpFrom(req),
    });

    return NextResponse.json({ ok: true });
  }

  // ── Pending invite ─────────────────────────────────────────
  const inv = await prisma.invitation.findFirst({
    where: { id, organizationId: admin.organizationId },
  });
  if (!inv) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  const data: Prisma.InvitationUpdateInput = {};
  if (name !== undefined) data.name = name;
  if (phone !== undefined) data.phone = phone;
  if (firmRole !== undefined) {
    data.firmRole = firmRole;
    data.userRole = firmRoleToUserRole(firmRole);
    data.role = firmRoleToOrgRole(firmRole);
  }
  if (specialization !== undefined) data.specialization = specialization;
  if (joiningDate !== undefined) data.joiningDate = joiningDate;

  await prisma.invitation.update({ where: { id }, data });

  await logTeamActivity({
    organizationId: admin.organizationId,
    actorId: admin.id,
    actorName: admin.name ?? admin.email,
    targetEmail: inv.email,
    action: "MEMBER_UPDATED",
    metadata: { kind: "invite", fields: Object.keys(data) },
    ipAddress: clientIpFrom(req),
  });

  return NextResponse.json({ ok: true });
}
