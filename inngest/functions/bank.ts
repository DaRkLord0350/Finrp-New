// ============================================================
// Inngest functions — Bank Sync + Bank Statement Import
// Replaces the BullMQ bank-sync and bank-import workers.
//   bank/sync.requested   → fetch → normalize → dedupe → reconcile →
//                           categorize → persist (runBankSync / Plaid)
//   bank/import.requested  → parse uploaded statement → import
// The periodic "accounts due for refresh" scan is the bank-auto-sync
// cron in inngest/functions/scheduled.ts.
// ============================================================

import { inngest } from "@/inngest/client";
import { EVENTS } from "@/inngest/events";
import { startBackgroundJob } from "@/lib/jobs/background-job";
import { runBankSync } from "@/lib/banking/sync-service";
import { syncTransactions, syncBalances } from "@/lib/banking/integrations/plaid-client";
import { processBankImport } from "@/lib/banking/bank-import-processor";
import type { BankSyncQueueJobData } from "@/lib/banking/queue";
import type { BankImportJobData } from "@/lib/banking/types";

export const bankSync = inngest.createFunction(
  {
    id: "bank-sync",
    name: "Bank Sync",
    concurrency: 3,
    retries: 3,
    triggers: [{ event: EVENTS.BANK_SYNC_REQUESTED }],
  },
  async ({ event, step, runId, attempt }) => {
    const data = event.data as BankSyncQueueJobData;

    const bg = await startBackgroundJob({
      type: "bank.sync",
      organizationId: data.organizationId,
      referenceId: data.bankAccountId ?? data.consentDbId ?? null,
      idempotencyKey: `bank.sync:${data.bankSyncJobId}`,
      eventName: event.name,
      eventId: event.id,
      runId,
      attempt: attempt + 1,
      metadata: { provider: data.provider, trigger: data.trigger },
    });

    try {
      const result = await step.run("run-bank-sync", async () => {
        if (data.provider === "PLAID") {
          if (!data.connectionId) throw new Error("Plaid connectionId required");
          const r = await syncTransactions(data.connectionId, data.organizationId);
          await syncBalances(data.connectionId, data.organizationId);
          return { provider: "PLAID", added: r.added, modified: r.modified };
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
          attempt: attempt + 1,
        });
        return {
          provider: "SETU_AA",
          syncHistoryId: outcome.syncHistoryId,
          status: outcome.status,
          txnsSaved: outcome.txnsSaved,
        };
      });

      await bg.complete(result);
      return result;
    } catch (err) {
      await bg.fail(err);
      throw err;
    }
  }
);

export const bankImport = inngest.createFunction(
  {
    id: "bank-import",
    name: "Bank Statement Import",
    concurrency: 2,
    retries: 3,
    triggers: [{ event: EVENTS.BANK_IMPORT_REQUESTED }],
  },
  async ({ event, step, runId, attempt }) => {
    const data = event.data as BankImportJobData;

    const bg = await startBackgroundJob({
      type: "bank.import",
      organizationId: data.organizationId,
      referenceId: data.importId,
      idempotencyKey: `bank.import:${data.importId}`,
      eventName: event.name,
      eventId: event.id,
      runId,
      attempt: attempt + 1,
      metadata: { fileType: data.fileType },
    });

    try {
      await step.run("process-bank-import", () =>
        processBankImport(data, (progress) => bg.setProgress(progress))
      );
      await bg.complete();
      return { importId: data.importId, status: "DONE" };
    } catch (err) {
      await bg.fail(err);
      throw err;
    }
  }
);
