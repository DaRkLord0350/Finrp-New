// ============================================================
// POST /api/firm/tasks/bulk
//   → bulk (re)assign a set of tasks to one CA.
//   Body: { taskIds: string[], assignedCaId: string }
//
// RBAC: CA_FIRM_ADMIN only, scoped to the admin's organization.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";
import { logTaskActivity } from "@/lib/firm/tasks";

export async function POST(req: NextRequest) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const taskIds: string[] = Array.isArray(body?.taskIds) ? body.taskIds.map(String) : [];
  const assignedCaId = String(body?.assignedCaId ?? "").trim();

  if (taskIds.length === 0) return NextResponse.json({ error: "No tasks selected" }, { status: 400 });
  if (!assignedCaId) return NextResponse.json({ error: "assignedCaId is required" }, { status: 400 });

  const ca = await prisma.user.findFirst({
    where: { id: assignedCaId, organizationId: admin.organizationId, userRole: { in: ["CA", "CA_FIRM_ADMIN"] } },
    select: { id: true, name: true, email: true },
  });
  if (!ca) return NextResponse.json({ error: "CA not found" }, { status: 404 });

  // Only tasks in this org that aren't already on the target CA.
  const tasks = await prisma.firmTask.findMany({
    where: { id: { in: taskIds }, organizationId: admin.organizationId, assignedCaId: { not: assignedCaId } },
    select: { id: true },
  });
  if (tasks.length === 0) return NextResponse.json({ moved: 0 });

  const ids = tasks.map((t) => t.id);
  await prisma.firmTask.updateMany({ where: { id: { in: ids } }, data: { assignedCaId } });

  // Per-task activity (audit) + a single notification to the new owner.
  await Promise.all(
    ids.map((taskId) =>
      logTaskActivity({
        taskId,
        actorId: admin.id,
        actorName: admin.name ?? admin.email,
        action: "REASSIGNED",
        metadata: { toCa: ca.name ?? ca.email, bulk: true },
      }).catch(() => {})
    )
  );

  await prisma.notification
    .create({
      data: {
        organizationId: admin.organizationId,
        userId: assignedCaId,
        type: "TASK_ASSIGNED",
        title: "Tasks Assigned",
        message: `${ids.length} task${ids.length !== 1 ? "s" : ""} assigned to you.`,
        referenceType: "firm_task",
      },
    })
    .catch(() => {});

  return NextResponse.json({ moved: ids.length });
}
