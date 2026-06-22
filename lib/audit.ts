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
    // AuditLog.userId is a FK to User.id. Callers may hand us either an internal
    // User.id or a Clerk id (e.g. straight from auth()), and the referenced user
    // may not exist at all. Resolve to a valid User.id or null so we never throw
    // a P2003 foreign-key violation (audit_logs_userId_fkey).
    const userId = await resolveUserId(input.userId);

    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId,
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

/**
 * Resolve an incoming user identifier to a valid `User.id`, or null.
 * Accepts an internal `User.id` or a Clerk id (`user_…`). Returns null when the
 * value is missing or doesn't correspond to any user, so the audit write can
 * proceed without violating the userId foreign key.
 */
async function resolveUserId(userId?: string | null): Promise<string | null> {
  if (!userId) return null;

  const user = await prisma.user.findFirst({
    where: { OR: [{ id: userId }, { clerkId: userId }] },
    select: { id: true },
  });
  return user?.id ?? null;
}
