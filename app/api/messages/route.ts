import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const messages = await prisma.message.findMany({
    where: {
      OR: [{ senderId: user.id }, { receiverId: user.id }],
      organizationId: user.organizationId,
    },
    include: {
      sender: { select: { id: true, name: true, email: true, userRole: true } },
      receiver: { select: { id: true, name: true, email: true, userRole: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Mark received messages as read
  await prisma.message.updateMany({
    where: { receiverId: user.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  }).catch(() => {});

  return NextResponse.json({ messages, currentUserId: user.id });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { receiverId, content, subject } = await req.json();
  if (!receiverId || !content?.trim()) {
    return NextResponse.json({ error: "receiverId and content are required" }, { status: 400 });
  }

  // Tenant isolation: the receiver must be in the SAME organization, or a
  // CA with an active ClientAssignment to this user's org. Prevents sending
  // (and notifying / probing existence of) users in other organizations.
  const receiver = await prisma.user.findFirst({
    where: {
      id: receiverId,
      OR: [
        { organizationId: user.organizationId },
        {
          clientAssignments: {
            some: { organizationId: user.organizationId, isActive: true },
          },
        },
      ],
    },
    select: { id: true },
  });
  if (!receiver) {
    return NextResponse.json(
      { error: "Receiver not found in your organization" },
      { status: 404 }
    );
  }

  const message = await prisma.message.create({
    data: {
      senderId: user.id,
      receiverId,
      organizationId: user.organizationId,
      content: content.trim(),
      subject: subject?.trim() || null,
    },
  });

  // Notify receiver
  await prisma.notification.create({
    data: {
      organizationId: user.organizationId,
      userId: receiverId,
      type: "MESSAGE_RECEIVED",
      title: "New Message",
      message: `${user.name ?? user.email} sent you a message.`,
      referenceId: message.id,
      referenceType: "message",
    },
  }).catch(() => {});

  return NextResponse.json({ message }, { status: 201 });
}
