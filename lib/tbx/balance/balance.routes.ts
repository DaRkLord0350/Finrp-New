// ============================================================
// FinRP — TBX Balance route handlers
// Thin handler logic called by app/api/banking/sync/route.ts.
// Persistence/orchestration lives in balance.service.ts; this file
// only deals with HTTP concerns (rate limiting, dispatch, response shape).
// ============================================================

import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { EVENTS } from "@/inngest/events";

const MIN_RESYNC_INTERVAL_MS = 5 * 60_000;

export class BalanceSyncError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "BalanceSyncError";
  }
}

export interface TriggerBalanceSyncResult {
  jobId: string;
  status: "queued";
}

/** Enqueue a balance sync for one account, honoring the same-account rate limit unless forced. */
export async function triggerBalanceSync(
  organizationId: string,
  bankAccountId: string,
  force: boolean
): Promise<TriggerBalanceSyncResult> {
  const account = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, organizationId, deletedAt: null },
    select: { id: true, lastSyncAt: true },
  });
  if (!account) throw new BalanceSyncError("Account not found", 404);

  if (!force && account.lastSyncAt) {
    const msSinceSync = Date.now() - account.lastSyncAt.getTime();
    if (msSinceSync < MIN_RESYNC_INTERVAL_MS) {
      throw new BalanceSyncError("Synced recently — pass force=true to override", 429);
    }
  }

  const jobId = `tbx.balance-sync:${bankAccountId}:manual:${Date.now()}`;
  await inngest.send({
    name: EVENTS.TBX_BALANCE_SYNC_REQUESTED,
    data: { organizationId, bankAccountId, trigger: "MANUAL" },
    id: jobId,
  });

  return { jobId, status: "queued" };
}
