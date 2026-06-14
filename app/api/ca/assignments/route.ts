// ============================================================
// /api/ca/assignments — ClientAssignment management
//
//   GET  → list assignments (scope depends on role)
//   POST → create / reactivate an assignment
//
// Authorization:
//   ADMIN          → manage every assignment
//   CA_FIRM_ADMIN  → manage assignments for CAs in their firm
//                    (including themselves)
//   CA             → read-only view of their own assignments
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { invalidateWorkspaceAccess } from "@/lib/workspace/assignments";
import { recordClientActivity } from "@/lib/workspace/audit";
import { WORKSPACE_PERMISSIONS } from "@/lib/workspace/permissions";
import type { ClientPermission, Prisma } from "@prisma/client";

function parsePermissions(input: unknown): ClientPermission[] | null {
  if (input === undefined) return [...WORKSPACE_PERMISSIONS];
  if (!Array.isArray(input)) return null;
  const valid = input.every((p) =>
    (WORKSPACE_PERMISSIONS as string[]).includes(p as string)
  );
  return valid ? (input as ClientPermission[]) : null;
}

// ---------------------------------------------------------------------------
// GET — list
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    let user;
    try {
      user = await getCurrentUser();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.userRole || user.userRole === "CUSTOMER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get("organizationId");
    const includeInactive = searchParams.get("includeInactive") === "true";

    const where: Prisma.ClientAssignmentWhereInput = {
      ...(includeInactive ? {} : { isActive: true }),
      ...(organizationId ? { organizationId } : {}),
    };

    if (user.userRole === "CA") {
      where.caUserId = user.id;
    } else if (user.userRole === "CA_FIRM_ADMIN") {
      where.OR = [{ caUserId: user.id }, ...(user.firmId ? [{ firmId: user.firmId }] : [])];
    }
    // ADMIN — no extra scoping

    const assignments = await prisma.clientAssignment.findMany({
      where,
      include: {
        caUser: { select: { id: true, name: true, email: true, userRole: true } },
        organization: {
          select: {
            id: true,
            name: true,
            businessProfile: { select: { businessName: true, gstin: true } },
          },
        },
        assignedBy: { select: { name: true, email: true } },
      },
      orderBy: { assignedAt: "desc" },
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error("[GET /api/ca/assignments]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — create / reactivate
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => null);
    if (!body?.caUserId || !body?.organizationId) {
      return NextResponse.json(
        { error: "caUserId and organizationId are required" },
        { status: 400 }
      );
    }

    const permissions = parsePermissions(body.permissions);
    if (!permissions) {
      return NextResponse.json({ error: "Invalid permissions" }, { status: 400 });
    }

    const [caUser, organization] = await Promise.all([
      prisma.user.findUnique({
        where: { id: body.caUserId },
        select: { id: true, name: true, email: true, userRole: true, firmId: true },
      }),
      prisma.organization.findUnique({
        where: { id: body.organizationId },
        select: { id: true, name: true },
      }),
    ]);

    if (!caUser || !caUser.userRole || caUser.userRole === "CUSTOMER") {
      return NextResponse.json(
        { error: "Target user must be a CA or firm admin" },
        { status: 400 }
      );
    }
    if (!organization) {
      return NextResponse.json({ error: "Client organization not found" }, { status: 404 });
    }
    // Firm admins can only assign CAs within their own firm.
    if (user.userRole === "CA_FIRM_ADMIN" && caUser.id !== user.id && caUser.firmId !== user.firmId) {
      return NextResponse.json(
        { error: "You can only assign CAs belonging to your firm" },
        { status: 403 }
      );
    }

    const assignment = await prisma.clientAssignment.upsert({
      where: {
        caUserId_organizationId: {
          caUserId: caUser.id,
          organizationId: organization.id,
        },
      },
      create: {
        caUserId: caUser.id,
        organizationId: organization.id,
        firmId: caUser.firmId,
        permissions,
        notes: body.notes ?? null,
        assignedById: user.id,
      },
      update: {
        isActive: true,
        revokedAt: null,
        permissions,
        notes: body.notes ?? null,
        assignedById: user.id,
        assignedAt: new Date(),
      },
    });

    await invalidateWorkspaceAccess(organization.id);
    await recordClientActivity({
      caUserId: user.id,
      organizationId: organization.id,
      action: "ASSIGNMENT_CREATED",
      summary: `Assigned ${caUser.name ?? caUser.email} to "${organization.name}"`,
      entity: "clientAssignment",
      entityId: assignment.id,
      metadata: { permissions, targetCaUserId: caUser.id },
    });

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/ca/assignments]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
