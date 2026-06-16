// ============================================================
// POST /api/firm/notifications/[id]/read  → mark one as read
// RBAC: CA_FIRM_ADMIN only (scoped to own notifications).
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await prisma.notification.updateMany({
    where: { id, userId: admin.id, organizationId: admin.organizationId },
    data: { isRead: true, readAt: new Date() },
  });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
