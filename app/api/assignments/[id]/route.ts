// ============================================================
// PATCH  /api/assignments/[id]  — reassign to a different CA
//   Body: { caId, notes? }
// DELETE /api/assignments/[id]  — remove (deactivate) assignment
//
// RBAC: CA_FIRM_ADMIN only, scoped to the admin's organization.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";
import { clientIpFrom } from "@/lib/team/activity";
import { verifyCa, createAssignment, removeAssignment } from "@/lib/firm/assignments";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const caId = body?.caId as string | undefined;
  if (!caId) return NextResponse.json({ error: "caId is required" }, { status: 400 });

  const current = await prisma.customerAssignment.findUnique({
    where: { id },
    include: { customer: { select: { id: true, organizationId: true } } },
  });
  if (!current || current.customer.organizationId !== admin.organizationId)
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  const ca = await verifyCa(admin.organizationId, caId);
  if (!ca) return NextResponse.json({ error: "CA not found in this firm" }, { status: 404 });

  const assignment = await createAssignment({
    admin,
    customerId: current.customer.id,
    caId,
    notes: body?.notes?.trim() || null,
    action: "CA_REASSIGNED",
    ipAddress: clientIpFrom(req),
  });

  return NextResponse.json({ assignment });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const removed = await removeAssignment({ admin, assignmentId: id, ipAddress: clientIpFrom(req) });
  if (!removed) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
