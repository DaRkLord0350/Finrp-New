// ============================================================
// POST /api/firm/team/[id]/deactivate
//   Body: { active?: boolean }  → true reactivates, false (default)
//   deactivates the member. Users only. Admins cannot change their
//   own status (avoids locking themselves out).
//
// RBAC: CA_FIRM_ADMIN only, scoped to the admin's organization.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";
import { logTeamActivity, clientIpFrom } from "@/lib/team/activity";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const active = body?.active === true;

  if (id === admin.id)
    return NextResponse.json({ error: "You cannot change your own status" }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: { id, organizationId: admin.organizationId },
  });
  if (!user) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  await prisma.user.update({ where: { id }, data: { isActive: active } });

  await logTeamActivity({
    organizationId: admin.organizationId,
    actorId: admin.id,
    actorName: admin.name ?? admin.email,
    targetUserId: id,
    targetEmail: user.email,
    action: active ? "MEMBER_REACTIVATED" : "MEMBER_DEACTIVATED",
    ipAddress: clientIpFrom(req),
  });

  return NextResponse.json({ ok: true, isActive: active });
}
