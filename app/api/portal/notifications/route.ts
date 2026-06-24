// ============================================================
// /api/portal/notifications
//   GET  → role-aware list of portal notifications
//   POST → mark read ({ ids?: string[], all?: boolean })
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFirmSide, requireCustomer } from "@/lib/client-portal/auth";
import { listCustomerNotifications, listFirmNotifications } from "@/lib/client-portal/queries";
import type { Prisma } from "@prisma/client";

export async function GET() {
  const firm = await requireFirmSide();
  if (firm) {
    const items = await listFirmNotifications(firm.organizationId, firm.id);
    return NextResponse.json({ notifications: items, unread: items.filter((n) => !n.isRead).length });
  }

  const customer = await requireCustomer();
  if (customer) {
    const items = await listCustomerNotifications(
      customer.ctx.organizationId,
      customer.ctx.customerId,
      customer.actor.id
    );
    return NextResponse.json({ notifications: items, unread: items.filter((n) => !n.isRead).length });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ids: string[] | null = Array.isArray(body?.ids) ? body.ids : null;
  const idFilter = ids ? { id: { in: ids } } : { isRead: false };

  const firm = await requireFirmSide();
  if (firm) {
    const where: Prisma.PortalNotificationWhereInput = {
      organizationId: firm.organizationId,
      audience: { in: ["CA", "FIRM"] },
      OR: [{ recipientUserId: firm.id }, { recipientUserId: null }],
      ...idFilter,
    };
    const r = await prisma.portalNotification.updateMany({ where, data: { isRead: true, readAt: new Date() } });
    return NextResponse.json({ read: r.count });
  }

  const customer = await requireCustomer();
  if (customer) {
    const where: Prisma.PortalNotificationWhereInput = {
      organizationId: customer.ctx.organizationId,
      audience: "CUSTOMER",
      OR: [
        { recipientUserId: customer.actor.id },
        { recipientUserId: null, customerId: customer.ctx.customerId },
      ],
      ...idFilter,
    };
    const r = await prisma.portalNotification.updateMany({ where, data: { isRead: true, readAt: new Date() } });
    return NextResponse.json({ read: r.count });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
