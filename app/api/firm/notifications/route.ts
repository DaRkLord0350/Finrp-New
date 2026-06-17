// ============================================================
// GET /api/firm/notifications  → the firm admin's in-app inbox
//   ?unread=1 to filter, returns { notifications, unread }
//
// RBAC: CA_FIRM_ADMIN only.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";

export async function GET(req: NextRequest) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const unreadOnly = req.nextUrl.searchParams.get("unread") === "1";

  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: {
        organizationId: admin.organizationId,
        userId: admin.id,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({
      where: { organizationId: admin.organizationId, userId: admin.id, isRead: false },
    }),
  ]);

  return NextResponse.json({ notifications, unread });
}
