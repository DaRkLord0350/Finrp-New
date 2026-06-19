// ============================================================
// Bulk Account Update Service — create + enqueue replace-account jobs.
// ============================================================

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { enqueueBulkAccountUpdate } from "@/lib/accounting/workers/bulk-account-update.worker";

class BulkUpdateError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message);
    this.name = "BulkUpdateError";
  }
}
export { BulkUpdateError };

type Actor = { userId: string | null };

export const bulkAccountUpdateService = {
  list(organizationId: string) {
    return prisma.bulkAccountUpdateJob.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 50 });
  },

  async get(organizationId: string, id: string) {
    const job = await prisma.bulkAccountUpdateJob.findFirst({ where: { id, organizationId } });
    if (!job) throw new BulkUpdateError("Job not found", 404);
    return job;
  },

  async create(organizationId: string, actor: Actor, input: { fromAccountId: string; toAccountId: string; scopes: string[] }) {
    if (input.fromAccountId === input.toAccountId) throw new BulkUpdateError("Source and target accounts must differ", 422);

    const [from, to] = await Promise.all([
      prisma.account.findFirst({ where: { id: input.fromAccountId, organizationId, deletedAt: null }, select: { id: true, type: true, code: true } }),
      prisma.account.findFirst({ where: { id: input.toAccountId, organizationId, deletedAt: null }, select: { id: true, type: true, code: true } }),
    ]);
    if (!from) throw new BulkUpdateError("Source account not found", 404);
    if (!to) throw new BulkUpdateError("Target account not found", 404);
    if (from.type !== to.type) throw new BulkUpdateError(`Accounts must be the same type (source is ${from.type}, target is ${to.type})`, 422);

    const job = await prisma.bulkAccountUpdateJob.create({
      data: {
        organizationId,
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        scopes: input.scopes,
        createdById: actor.userId,
      },
    });

    // Enqueue for the background worker; if Redis is unavailable the job stays
    // QUEUED and can be retried — it is never silently lost.
    let queued = true;
    try {
      await enqueueBulkAccountUpdate({ jobId: job.id, organizationId });
    } catch (err) {
      queued = false;
      console.error("[bulk-account-update] enqueue failed:", err);
    }

    await createAuditLog({
      organizationId, userId: actor.userId ?? undefined, action: "UPDATE", entity: "bulk_account_update", entityId: job.id,
      description: `Queued bulk account update ${from.code} → ${to.code} (${input.scopes.length} scope(s))`,
    });

    return { job, queued };
  },
};
