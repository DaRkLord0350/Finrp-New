// ============================================================
// /api/firm/tasks/[id]/comments
//   GET  → comments (oldest first)
//   POST → add a comment { body }
//
// RBAC: any firm member (CA or CA_FIRM_ADMIN), org-scoped. CA must
// be the assignee.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFirmMemberApi } from "@/lib/auth/firm-admin";
import { logTaskActivity } from "@/lib/firm/tasks";

async function authorizedTask(orgId: string, taskId: string) {
  return prisma.firmTask.findFirst({ where: { id: taskId, organizationId: orgId } });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getFirmMemberApi();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const task = await authorizedTask(user.organizationId, id);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const comments = await prisma.firmTaskComment.findMany({
    where: { taskId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ comments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getFirmMemberApi();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const task = await authorizedTask(user.organizationId, id);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (user.userRole === "CA" && task.assignedCaId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const text = String(body?.body ?? "").trim();
  if (!text) return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });

  const comment = await prisma.firmTaskComment.create({
    data: { taskId: id, authorId: user.id, authorName: user.name ?? user.email, body: text },
  });

  await logTaskActivity({
    taskId: id,
    actorId: user.id,
    actorName: user.name ?? user.email,
    action: "COMMENTED",
  });

  // Notify the counterpart (assignee ↔ creator), skipping self.
  const notifyUserId = user.id === task.assignedCaId ? task.createdById : task.assignedCaId;
  if (notifyUserId && notifyUserId !== user.id) {
    await prisma.notification
      .create({
        data: {
          organizationId: user.organizationId,
          userId: notifyUserId,
          type: "MESSAGE_RECEIVED",
          title: "New comment on a task",
          message: `${user.name ?? user.email} commented on "${task.title}".`,
          referenceId: id,
          referenceType: "firm_task",
        },
      })
      .catch(() => {});
  }

  return NextResponse.json({ comment }, { status: 201 });
}
