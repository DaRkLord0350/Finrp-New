// ============================================================
// FinRP — TBX Statement route handlers
// Thin handler logic called by app/api/banking/sync/route.ts.
// Mirrors lib/tbx/balance/balance.routes.ts's shape exactly.
// ============================================================

import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { EVENTS } from "@/inngest/events";

const MIN_RESYNC_INTERVAL_MS = 5 * 60_000;

export class StatementSyncError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "StatementSyncError";
  }
}

export interface TriggerStatementSyncResult {
  jobId: string;
  status: "queued";
}

/** Enqueue a statement sync for one account, honoring the same-account rate limit unless forced. */
export async function triggerStatementSync(
  organizationId: string,
  bankAccountId: string,
  force: boolean
): Promise<TriggerStatementSyncResult> {
  const account = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, organizationId, deletedAt: null },
    select: { id: true, lastSyncAt: true },
  });
  if (!account) throw new StatementSyncError("Account not found", 404);

  if (!force && account.lastSyncAt) {
    const msSinceSync = Date.now() - account.lastSyncAt.getTime();
    if (msSinceSync < MIN_RESYNC_INTERVAL_MS) {
      throw new StatementSyncError("Synced recently — pass force=true to override", 429);
    }
  }

  const jobId = `tbx.statement-sync:${bankAccountId}:manual:${Date.now()}`;
  await inngest.send({
    name: EVENTS.TBX_STATEMENT_SYNC_REQUESTED,
    data: { organizationId, bankAccountId, trigger: "MANUAL" },
    id: jobId,
  });

  return { jobId, status: "queued" };
}
