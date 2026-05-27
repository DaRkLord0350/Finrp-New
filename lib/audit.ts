// ============================================================
// FinRP — Audit Log Helper
// Thin wrapper around prisma.auditLog.create with safe defaults.
// ============================================================

import { prisma } from "@/lib/prisma";
import { AuditAction, Prisma } from "@prisma/client";

interface AuditLogInput {
  organizationId: string;
  userId?: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  description: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
}

export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        description: input.description,
        oldValue: input.oldValue ?? undefined,
        newValue: input.newValue ?? undefined,
      },
    });
  } catch (err) {
    // Audit log failures must never break the main flow
    console.error("[audit] Failed to write audit log:", err);
  }
}
