// ============================================================
// lib/tax/core/audit.ts
//
// Thin wrapper over the shared audit-log writer for tax-engine
// entities. Keeps entity naming consistent ("tax.gst.invoice", ...)
// and is non-throwing (audit failures must never break a filing flow).
// ============================================================

import { createAuditLog } from "@/lib/audit";
import type { AuditAction, Prisma } from "@prisma/client";

export interface TaxAuditInput {
  organizationId: string;
  userId?: string | null;
  action: AuditAction;
  /** Domain entity, e.g. "tax.gst.gstr1", "tax.config", "tax.filing". */
  entity: string;
  entityId?: string | null;
  description: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
}

export async function taxAudit(input: TaxAuditInput): Promise<void> {
  await createAuditLog({
    organizationId: input.organizationId,
    userId: input.userId ?? undefined,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? undefined,
    description: input.description,
    oldValue: input.oldValue,
    newValue: input.newValue,
  });
}
