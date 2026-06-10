// ============================================================
// FinRP Banking OS — Bank Sync BullMQ Worker
// Processes BankSyncJobData: syncs from Setu AA or Plaid,
// runs risk detection + categorization, updates balances.
// ============================================================

import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { fetchAndStoreTransactions } from "../integrations/setu-aa";
import { syncTransactions, syncBalances } from "../integrations/plaid-client";
import { bulkCategorize } from "../categorization-engine";
import { analyzeRecentTransactions } from "../risk-detector";
import { updateAccountBalance } from "../ledger-integration";
import { markInDbDuplicates } from "../duplicate-detector";
import type { BankSyncJobData } from "../types";

export const BANK_SYNC_QUEUE = "finrp-bank-sync";

// ---------------------------------------------------------------------------
// Create worker
// ---------------------------------------------------------------------------
export function createBankSyncWorker() {
  const worker = new Worker<BankSyncJobData>(
    BANK_SYNC_QUEUE,
    async (job: Job<BankSyncJobData>) => {
      return processBankSync(job);
    },
    {
      connection: getRedisConnection("worker"),
      concurrency: 3,
      limiter: { max: 10, duration: 60_000 },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[BankSyncWorker] ${job.id} completed`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[BankSyncWorker] ${job?.id} failed: ${err.message}`);
  });
  worker.on("error", (err) => {
    console.error("[BankSyncWorker] Worker error:", err);
  });

  return worker;
}

// ---------------------------------------------------------------------------
// Core sync processor
// ---------------------------------------------------------------------------
async function processBankSync(job: Job<BankSyncJobData>): Promise<void> {
  const {
    bankSyncJobId,
    organizationId,
    bankAccountId,
    connectionId,
    consentId,
    provider,
    isIncremental,
    fromDate,
    toDate,
  } = job.data;

  await prisma.bankAccount.update({
    where: { id: bankAccountId },
    data: { lastSyncStatus: "SYNCING" },
  }).catch(() => {});

  await job.updateProgress(10);

  const syncStart = new Date();

  try {
    let savedCount = 0;
    let duplicatesCount = 0;

    if (provider === "SETU_AA") {
      // Fetch consent handle from DB
      const consent = await prisma.bankConsent.findFirst({
        where: {
          organizationId,
          bankAccountId,
          status: "ACTIVE",
          provider: "SETU",
        },
        orderBy: { createdAt: "desc" },
        select: { consentHandle: true },
      });

      if (!consent?.consentHandle) {
        throw new Error("No active Setu consent for this account");
      }

      const result = await fetchAndStoreTransactions(
        organizationId,
        consent.consentHandle,
        bankAccountId,
        fromDate ? new Date(fromDate) : undefined,
        toDate ? new Date(toDate) : undefined
      );
      savedCount = result.saved;
      duplicatesCount = result.duplicates;

    } else if (provider === "PLAID") {
      if (!connectionId) throw new Error("Plaid connectionId required");
      const result = await syncTransactions(connectionId, organizationId);
      await syncBalances(connectionId, organizationId);
      savedCount = result.added + result.modified;
      duplicatesCount = result.removed;
    }

    await job.updateProgress(60);

    // Post-sync pipeline
    if (savedCount > 0) {
      await markInDbDuplicates(bankAccountId, 2);
      await bulkCategorize(organizationId, undefined);
      await analyzeRecentTransactions(organizationId, bankAccountId, syncStart);
    }

    await job.updateProgress(85);

    await updateAccountBalance(bankAccountId, organizationId);

    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: "SUCCESS",
        lastSyncError: null,
        nextSyncAt: computeNextSync(),
      },
    });

    await job.updateProgress(100);
    console.log(`[BankSyncWorker] ${bankAccountId}: saved=${savedCount}, dupes=${duplicatesCount}`);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: {
        lastSyncStatus: "FAILED",
        lastSyncError: message,
      },
    }).catch(() => {});
    throw err;
  }
}

function computeNextSync(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 6);
  return d;
}
