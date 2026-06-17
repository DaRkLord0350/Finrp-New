import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { logTaskActivity } from "@/lib/firm/tasks";

async function getFirmUser() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user || !["CA_FIRM_ADMIN", "CA"].includes(user.userRole ?? "")) return null;
  return user;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getFirmUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { status, notes } = body;

  // Scoped findFirst enforces organizationId
  const task = await prisma.firmTask.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // CA can only update their own tasks
  if (user.userRole === "CA" && task.assignedCaId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const statusChanged = !!status && status !== task.status;

  await prisma.firmTask.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(notes !== undefined && { notes }),
      ...(status === "COMPLETED" && { completedAt: new Date() }),
    },
  });

  if (statusChanged) {
    await logTaskActivity({
      taskId: id,
      actorId: user.id,
      actorName: user.name ?? user.email,
      action: "STATUS_CHANGED",
      fromStatus: task.status,
      toStatus: status,
    });
    // Notify the task creator when work completes (skip self-notify).
    if (status === "COMPLETED" && task.createdById !== user.id) {
      await prisma.notification
        .create({
          data: {
            organizationId: user.organizationId,
            userId: task.createdById,
            type: "SYSTEM",
            title: "Task completed",
            message: `"${task.title}" was marked completed.`,
            referenceId: id,
            referenceType: "firm_task",
          },
        })
        .catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getFirmUser();
  if (!user || user.userRole !== "CA_FIRM_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await prisma.firmTask.deleteMany({ where: { id, organizationId: user.organizationId } });
  if (result.count === 0) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
