import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await prisma.notification.findMany({
    where: {
      organizationId: user.organizationId,
      OR: [{ userId: user.id }, { userId: null }],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, markAll } = await req.json();

  if (markAll) {
    await prisma.notification.updateMany({
      where: { organizationId: user.organizationId, userId: user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  } else if (id) {
    await prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  return NextResponse.json({ success: true });
}
