// ============================================================
// /api/ca/assignments/[id] — update or revoke an assignment
//
//   PATCH → update permissions / notes, or revoke (isActive=false)
//
// Authorization: ADMIN anywhere; CA_FIRM_ADMIN within their firm.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { invalidateWorkspaceAccess } from "@/lib/workspace/assignments";
import { recordClientActivity } from "@/lib/workspace/audit";
import { WORKSPACE_PERMISSIONS } from "@/lib/workspace/permissions";
import type { ClientPermission, Prisma } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let user;
    try {
      user = await getCurrentUser();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.userRole !== "ADMIN" && user.userRole !== "CA_FIRM_ADMIN") {
      return NextResponse.json(
        { error: "Only admins and firm admins can manage assignments" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const assignment = await prisma.clientAssignment.findUnique({
      where: { id },
      include: {
        caUser: { select: { name: true, email: true, firmId: true } },
        organization: { select: { id: true, name: true } },
      },
    });
    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }
    if (
      user.userRole === "CA_FIRM_ADMIN" &&
      assignment.firmId !== user.firmId &&
      assignment.caUserId !== user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const data: Prisma.ClientAssignmentUpdateInput = {};
    let revoked = false;

    if (body.permissions !== undefined) {
      if (
        !Array.isArray(body.permissions) ||
        !body.permissions.every((p: string) =>
          (WORKSPACE_PERMISSIONS as string[]).includes(p)
        )
      ) {
        return NextResponse.json({ error: "Invalid permissions" }, { status: 400 });
      }
      data.permissions = body.permissions as ClientPermission[];
    }
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.isActive === false) {
      data.isActive = false;
      data.revokedAt = new Date();
      revoked = true;
    } else if (body.isActive === true) {
      data.isActive = true;
      data.revokedAt = null;
    }

    const updated = await prisma.clientAssignment.update({ where: { id }, data });

    await invalidateWorkspaceAccess(assignment.organizationId);
    await recordClientActivity({
      caUserId: user.id,
      organizationId: assignment.organizationId,
      action: revoked ? "ASSIGNMENT_REVOKED" : "ASSIGNMENT_UPDATED",
      summary: revoked
        ? `Revoked ${assignment.caUser.name ?? assignment.caUser.email}'s access to "${assignment.organization.name}"`
        : `Updated assignment of ${assignment.caUser.name ?? assignment.caUser.email} for "${assignment.organization.name}"`,
      entity: "clientAssignment",
      entityId: id,
      metadata: { changes: body },
    });

    return NextResponse.json({ assignment: updated });
  } catch (error) {
    console.error("[PATCH /api/ca/assignments/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
