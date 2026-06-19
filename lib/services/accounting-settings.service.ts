// ============================================================
// Accounting Settings Service — org-singleton config:
// transaction lock date + system account mappings + base currency.
// ============================================================

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { getAccountingSettings } from "@/lib/accounting/period";

type Actor = { userId: string | null };

export interface UpdateSettingsInput {
  baseCurrency?: string;
  lockDate?: Date | null;
  lockReason?: string | null;
  retainedEarningsAccountId?: string | null;
  forexGainLossAccountId?: string | null;
  roundingAccountId?: string | null;
}

export const accountingSettingsService = {
  get(organizationId: string) {
    return getAccountingSettings(organizationId);
  },

  async update(organizationId: string, actor: Actor, input: UpdateSettingsInput) {
    const before = await getAccountingSettings(organizationId);

    const updated = await prisma.accountingSettings.update({
      where: { organizationId },
      data: {
        ...(input.baseCurrency !== undefined && { baseCurrency: input.baseCurrency }),
        ...(input.lockDate !== undefined && { lockDate: input.lockDate }),
        ...(input.lockReason !== undefined && { lockReason: input.lockReason }),
        ...(input.retainedEarningsAccountId !== undefined && { retainedEarningsAccountId: input.retainedEarningsAccountId }),
        ...(input.forexGainLossAccountId !== undefined && { forexGainLossAccountId: input.forexGainLossAccountId }),
        ...(input.roundingAccountId !== undefined && { roundingAccountId: input.roundingAccountId }),
      },
    });

    const lockChanged = input.lockDate !== undefined && String(before.lockDate ?? "") !== String(updated.lockDate ?? "");
    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: lockChanged ? "LOCK" : "SETTINGS_CHANGE",
      entity: "accounting_settings",
      entityId: updated.id,
      description: lockChanged
        ? `Set books lock date to ${updated.lockDate ? updated.lockDate.toISOString().slice(0, 10) : "none"}`
        : "Updated accounting settings",
      oldValue: { lockDate: before.lockDate?.toISOString() ?? null },
      newValue: { lockDate: updated.lockDate?.toISOString() ?? null },
    });

    return updated;
  },
};
