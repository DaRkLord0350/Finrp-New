// ============================================================
// lib/firm/tasks.ts — FirmTask workflow helpers (Phase 6)
// ============================================================

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type TaskActivityAction =
  | "CREATED"
  | "STATUS_CHANGED"
  | "REASSIGNED"
  | "COMMENTED"
  | "ATTACHMENT_ADDED"
  | "UPDATED";

export async function logTaskActivity(p: {
  taskId: string;
  actorId?: string | null;
  actorName?: string | null;
  action: TaskActivityAction;
  fromStatus?: string | null;
  toStatus?: string | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.firmTaskActivity.create({
      data: {
        taskId: p.taskId,
        actorId: p.actorId ?? null,
        actorName: p.actorName ?? null,
        action: p.action,
        fromStatus: p.fromStatus ?? null,
        toStatus: p.toStatus ?? null,
        ...(p.metadata !== undefined ? { metadata: p.metadata } : {}),
      },
    });
  } catch (err) {
    console.error("[task-activity] log failed:", err);
  }
}
