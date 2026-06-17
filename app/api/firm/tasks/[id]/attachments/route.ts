// ============================================================
// /api/firm/tasks/[id]/attachments
//   GET  → attachments
//   POST → add an attachment { fileName, fileUrl, fileSize?, mimeType? }
//          (metadata + fileUrl pattern, like the document vault)
//
// RBAC: any firm member (CA or CA_FIRM_ADMIN), org-scoped.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFirmMemberApi } from "@/lib/auth/firm-admin";
import { logTaskActivity } from "@/lib/firm/tasks";
import { MAX_INLINE_BYTES } from "@/lib/vault/constants";

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

  const attachments = await prisma.firmTaskAttachment.findMany({
    where: { taskId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ attachments });
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
  const fileName = String(body?.fileName ?? "").trim();
  const fileUrl = String(body?.fileUrl ?? "").trim();
  const fileSize = Number(body?.fileSize ?? 0) || 0;
  if (!fileName || !fileUrl)
    return NextResponse.json({ error: "A file or file URL is required" }, { status: 400 });
  if (fileUrl.startsWith("data:") && fileSize > MAX_INLINE_BYTES)
    return NextResponse.json({ error: "Inline file too large — use a hosted URL" }, { status: 400 });

  const attachment = await prisma.firmTaskAttachment.create({
    data: {
      taskId: id,
      fileName,
      fileUrl,
      fileSize,
      mimeType: body?.mimeType ? String(body.mimeType) : null,
      uploadedById: user.id,
    },
  });

  await logTaskActivity({
    taskId: id,
    actorId: user.id,
    actorName: user.name ?? user.email,
    action: "ATTACHMENT_ADDED",
    metadata: { fileName },
  });

  return NextResponse.json({ attachment }, { status: 201 });
}
