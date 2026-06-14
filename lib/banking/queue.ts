// ============================================================
// FinRP Banking OS — Bank Sync Queue
// Centralized BullMQ queue access for bank syncs, following the
// lib/jobs/queues registry pattern: lazy singletons, deterministic
// job ids (idempotent enqueue), and a repeatable scheduler job
// that fans out per-account syncs for accounts due for refresh.
// ============================================================

import { Queue } from "bullmq";
import { getRedisConnection } from "@/lib/redis";
import { createBankingLogger } from "./logger";
import type { SyncTrigger, SyncType } from "@prisma/client";

const log = createBankingLogger("queue");

export const BANK_SYNC_QUEUE = "finrp-bank-sync";

/** Repeatable job that scans for accounts due for auto-refresh. */
export const BANK_AUTO_SYNC_JOB = "bank-auto-sync-scan";
export const BANK_AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 min

export interface BankSyncQueueJobData {
  bankSyncJobId: string;
  organizationId: string;
  bankAccountId?: string;
  consentDbId?: string;
  /** BankConnection.id — Plaid/direct-API providers only. */
  connectionId?: string;
  /** Reuse an already-completed Setu data session (webhook path). */
  existingSessionId?: string;
  provider: string;
  trigger: SyncTrigger;
  syncType?: SyncType;
  fromDate?: string;
  toDate?: string;
}

let bankSyncQueue: Queue<BankSyncQueueJobData> | null = null;

export function getBankSyncQueue(): Queue<BankSyncQueueJobData> {
  if (!bankSyncQueue) {
    bankSyncQueue = new Queue<BankSyncQueueJobData>(BANK_SYNC_QUEUE, {
      connection: getRedisConnection("queue"),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return bankSyncQueue;
}

/**
 * Enqueue a bank sync. jobId is deterministic per (org, account, trigger,
 * 5-min bucket) so double-clicks and duplicate webhooks collapse into one job.
 */
export async function enqueueBankSync(
  data: Omit<BankSyncQueueJobData, "bankSyncJobId">,
  opts?: { dedupeKey?: string }
): Promise<string> {
  const bucket = Math.floor(Date.now() / (5 * 60_000));
  const dedupe =
    opts?.dedupeKey ??
    `${data.organizationId}:${data.bankAccountId ?? data.consentDbId ?? "org"}:${data.trigger}:${bucket}`;
  const jobId = `bank-sync:${dedupe}`;

  const q = getBankSyncQueue();
  const job = await q.add("bank-sync", { ...data, bankSyncJobId: jobId }, { jobId });

  const resolvedId = job.id ?? jobId;
  log.info("bank sync enqueued", {
    jobId: resolvedId,
    organizationId: data.organizationId,
    bankAccountId: data.bankAccountId,
    trigger: data.trigger,
    deduplicated: !job.id,
  });
  return resolvedId;
}

/**
 * Register the repeatable auto-sync scan. Called once at worker startup;
 * idempotent thanks to the fixed jobId.
 */
export async function scheduleBankAutoSyncScan(): Promise<void> {
  const q = getBankSyncQueue();
  await q.add(
    BANK_AUTO_SYNC_JOB,
    {
      bankSyncJobId: BANK_AUTO_SYNC_JOB,
      organizationId: "*",
      provider: "SETU",
      trigger: "SCHEDULED",
    },
    {
      jobId: `cron:${BANK_AUTO_SYNC_JOB}`,
      repeat: { every: BANK_AUTO_SYNC_INTERVAL_MS },
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 10 },
    }
  );
  log.info("bank auto-sync scan scheduled", { intervalMs: BANK_AUTO_SYNC_INTERVAL_MS });
}
