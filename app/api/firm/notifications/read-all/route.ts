// ============================================================
// POST /api/firm/notifications/read-all  → mark all as read
// RBAC: CA_FIRM_ADMIN only (scoped to own notifications).
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";

export async function POST() {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.notification.updateMany({
    where: { organizationId: admin.organizationId, userId: admin.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
