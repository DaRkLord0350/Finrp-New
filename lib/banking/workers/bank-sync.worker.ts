// ============================================================
// FinRP Banking OS — Bank Sync BullMQ Worker
// Two job types on the finrp-bank-sync queue:
//   bank-sync            one sync run → lib/banking/sync-service
//   bank-auto-sync-scan  repeatable: finds accounts due for
//                        refresh and fans out bank-sync jobs
// Plaid connections keep their legacy path; Setu AA goes through
// the provider-based sync engine (BankSyncHistory, dedup, etc.).
// ============================================================

import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { runBankSync } from "../sync-service";
import { createBankingLogger } from "../logger";
import {
  BANK_SYNC_QUEUE,
  BANK_AUTO_SYNC_JOB,
  enqueueBankSync,
  type BankSyncQueueJobData,
} from "../queue";
import { syncTransactions, syncBalances } from "../integrations/plaid-client";

export { BANK_SYNC_QUEUE };

const log = createBankingLogger("sync-worker");

// ---------------------------------------------------------------------------
// Create worker
// ---------------------------------------------------------------------------
export function createBankSyncWorker() {
  const worker = new Worker<BankSyncQueueJobData>(
    BANK_SYNC_QUEUE,
    async (job: Job<BankSyncQueueJobData>) => {
      if (job.name === BANK_AUTO_SYNC_JOB) {
        return processAutoSyncScan();
      }
      return processBankSync(job);
    },
    {
      connection: getRedisConnection("worker"),
      concurrency: 3,
      limiter: { max: 10, duration: 60_000 },
    }
  );

  worker.on("completed", (job) => {
    log.info("job completed", { jobId: job.id, name: job.name });
  });
  worker.on("failed", (job, err) => {
    log.error("job failed", { jobId: job?.id, name: job?.name, error: err.message });
  });
  worker.on("error", (err) => {
    log.error("worker error", { error: err.message });
  });

  return worker;
}

// ---------------------------------------------------------------------------
// One sync run
// ---------------------------------------------------------------------------
async function processBankSync(job: Job<BankSyncQueueJobData>): Promise<void> {
  const data = job.data;
  await job.updateProgress(10);

  if (data.provider === "PLAID") {
    // Legacy Plaid path — connection-token based, unchanged.
    if (!data.connectionId) throw new Error("Plaid connectionId required");
    const result = await syncTransactions(data.connectionId, data.organizationId);
    await syncBalances(data.connectionId, data.organizationId);
    log.info("plaid sync done", { added: result.added, modified: result.modified });
    await job.updateProgress(100);
    return;
  }

  const outcome = await runBankSync({
    organizationId: data.organizationId,
    bankAccountId: data.bankAccountId,
    consentDbId: data.consentDbId,
    existingSessionId: data.existingSessionId,
    trigger: data.trigger,
    syncType: data.syncType,
    fromDate: data.fromDate ? new Date(data.fromDate) : undefined,
    toDate: data.toDate ? new Date(data.toDate) : undefined,
    attempt: job.attemptsMade + 1,
  });

  await job.updateProgress(100);
  log.info("sync run finished", {
    jobId: job.id,
    syncHistoryId: outcome.syncHistoryId,
    status: outcome.status,
    txnsSaved: outcome.txnsSaved,
  });
}

// ---------------------------------------------------------------------------
// Scheduled refresh: find accounts due for sync and fan out jobs
// ---------------------------------------------------------------------------
async function processAutoSyncScan(): Promise<void> {
  const now = new Date();

  const dueAccounts = await prisma.bankAccount.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      autoSyncEnabled: true,
      consentStatus: "ACTIVE",
      OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: now } }],
    },
    select: { id: true, organizationId: true },
    take: 200, // safety cap per scan; next scan picks up the rest
  });

  if (dueAccounts.length === 0) {
    log.debug("auto-sync scan: nothing due");
    return;
  }

  log.info("auto-sync scan: enqueueing", { count: dueAccounts.length });
  for (const account of dueAccounts) {
    await enqueueBankSync({
      organizationId: account.organizationId,
      bankAccountId: account.id,
      provider: "SETU_AA",
      trigger: "SCHEDULED",
      syncType: "INCREMENTAL",
    }).catch((err) =>
      log.warn("auto-sync enqueue failed", { bankAccountId: account.id, error: String(err) })
    );
  }
}
