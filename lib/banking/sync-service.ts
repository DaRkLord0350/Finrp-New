// ============================================================
// FinRP Banking OS — Account Sync Engine
// Single entry point for every bank data sync:
//   • initial sync        (after consent approval)
//   • incremental sync    (manual button / API)
//   • scheduled refresh   (repeatable BullMQ job)
//   • webhook-driven sync (Setu SESSION COMPLETED)
//
// Each run writes a BankSyncHistory row, dedupes transactions by
// (bankAccountId, externalTxnId), stores BankBalance snapshots,
// then reuses the existing post-sync pipeline: duplicate marking,
// rule categorization, risk detection, ledger balance update.
// ============================================================

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { BankTxnType, SyncRunStatus, SyncTrigger, SyncType } from "@prisma/client";
import { createBankingLogger } from "./logger";
import { getBankingProvider } from "./providers";
import { BankingProviderError, type FIDataResult, type NormalizedTransaction } from "./providers/types";
import { linkDiscoveredAccounts } from "./consent-service";
import { markInDbDuplicates } from "./duplicate-detector";
import { bulkCategorize } from "./categorization-engine";
import { analyzeRecentTransactions } from "./risk-detector";
import { updateAccountBalance } from "./ledger-integration";

const log = createBankingLogger("sync-service");

/** Overlap window re-fetched on incremental syncs to absorb FIP lag. */
const INCREMENTAL_OVERLAP_DAYS = 3;

export interface RunBankSyncOptions {
  organizationId: string;
  /** Sync a specific account (else: all accounts under the consent). */
  bankAccountId?: string;
  /** Explicit consent (DB id). Defaults to newest ACTIVE consent. */
  consentDbId?: string;
  trigger: SyncTrigger;
  syncType?: SyncType;
  fromDate?: Date;
  toDate?: Date;
  /** Reuse a data session Setu already completed (webhook path). */
  existingSessionId?: string;
  attempt?: number;
}

export interface BankSyncOutcome {
  syncHistoryId: string;
  status: SyncRunStatus;
  accountsLinked: number;
  txnsFetched: number;
  txnsSaved: number;
  txnsDuplicate: number;
  balancesSaved: number;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
export async function runBankSync(opts: RunBankSyncOptions): Promise<BankSyncOutcome> {
  const startedAt = new Date();

  // 1. Resolve the consent backing this sync
  const consent = await prisma.bankConsent.findFirst({
    where: {
      organizationId: opts.organizationId,
      deletedAt: null,
      ...(opts.consentDbId
        ? { id: opts.consentDbId }
        : { status: "ACTIVE", ...(opts.bankAccountId ? { bankAccountId: opts.bankAccountId } : {}) }),
    },
    orderBy: { createdAt: "desc" },
  });

  // Fall back to any active org-level consent (consents created before
  // account discovery aren't bound to a bankAccountId yet).
  const resolvedConsent =
    consent ??
    (await prisma.bankConsent.findFirst({
      where: { organizationId: opts.organizationId, status: "ACTIVE", deletedAt: null },
      orderBy: { createdAt: "desc" },
    }));

  if (!resolvedConsent?.consentId) {
    throw new Error("No active AA consent for this organization/account");
  }
  if (resolvedConsent.status !== "ACTIVE") {
    throw new Error(`Consent ${resolvedConsent.id} is ${resolvedConsent.status}, not ACTIVE`);
  }

  // 2. Compute the data range
  const account = opts.bankAccountId
    ? await prisma.bankAccount.findFirst({
        where: { id: opts.bankAccountId, organizationId: opts.organizationId, deletedAt: null },
        select: { id: true, lastSyncAt: true, linkedAccountRef: true },
      })
    : null;
  if (opts.bankAccountId && !account) throw new Error("Bank account not found");

  const now = new Date();
  const syncType: SyncType =
    opts.syncType ?? (account?.lastSyncAt || opts.trigger === "SCHEDULED" ? "INCREMENTAL" : "FULL");

  let fromDate = opts.fromDate;
  if (!fromDate) {
    if (syncType === "INCREMENTAL" && account?.lastSyncAt) {
      fromDate = new Date(account.lastSyncAt.getTime() - INCREMENTAL_OVERLAP_DAYS * 86_400_000);
    } else {
      fromDate = resolvedConsent.startDate ?? new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    }
  }
  const toDate = opts.toDate ?? now;

  // 3. Open the sync history record
  const history = await prisma.bankSyncHistory.create({
    data: {
      organizationId: opts.organizationId,
      bankAccountId: account?.id ?? resolvedConsent.bankAccountId,
      consentId: resolvedConsent.id,
      provider: resolvedConsent.provider,
      trigger: opts.trigger,
      syncType,
      status: "RUNNING",
      fromDate,
      toDate,
      attempt: opts.attempt ?? 1,
      dataSessionId: opts.existingSessionId,
      startedAt,
    },
  });

  log.info("sync started", {
    syncHistoryId: history.id,
    organizationId: opts.organizationId,
    trigger: opts.trigger,
    syncType,
    consentId: resolvedConsent.consentId,
  });

  try {
    // 4. Fetch FI data (reuse a completed session when the webhook gave us one)
    const provider = getBankingProvider(resolvedConsent.provider);
    let fiData: FIDataResult;
    if (opts.existingSessionId) {
      fiData = await provider.fetchSessionData(opts.existingSessionId);
      if (fiData.status !== "COMPLETED" && fiData.status !== "PARTIAL") {
        throw new BankingProviderError({
          provider: String(resolvedConsent.provider),
          message: `Data session ${opts.existingSessionId} is ${fiData.status}`,
          code: `SESSION_${fiData.status}`,
          retryable: fiData.status === "PENDING",
        });
      }
    } else {
      fiData = await provider.refreshData({
        consentId: resolvedConsent.consentId,
        dataRange: { from: fromDate, to: toDate },
      });
    }

    // 5. Ensure BankAccount rows exist for every discovered account
    const accountIds = await linkDiscoveredAccounts(
      opts.organizationId,
      resolvedConsent.id,
      fiData.accounts
    );

    // Map provider linkRefNumber → our bankAccountId
    const linkedAccounts = await prisma.bankAccount.findMany({
      where: { organizationId: opts.organizationId, id: { in: accountIds }, deletedAt: null },
      select: { id: true, linkedAccountRef: true },
    });
    const refToAccountId = new Map<string, string>();
    for (const acc of linkedAccounts) {
      if (acc.linkedAccountRef) refToAccountId.set(acc.linkedAccountRef, acc.id);
    }

    // 6. Persist balances (snapshot per account per day per source)
    let balancesSaved = 0;
    for (const bal of fiData.balances) {
      const bankAccountId = refToAccountId.get(bal.linkRefNumber);
      if (!bankAccountId) continue;
      if (account && bankAccountId !== account.id) continue; // single-account sync filter

      const day = new Date(Date.UTC(
        bal.balanceDate.getUTCFullYear(), bal.balanceDate.getUTCMonth(), bal.balanceDate.getUTCDate()
      ));
      await prisma.bankBalance.upsert({
        where: {
          bankAccountId_balanceDate_source: { bankAccountId, balanceDate: day, source: "AA_SETU" },
        },
        create: {
          organizationId: opts.organizationId,
          bankAccountId,
          balanceDate: day,
          currentBalance: new Prisma.Decimal(bal.currentBalance),
          availableBalance: bal.availableBalance !== undefined ? new Prisma.Decimal(bal.availableBalance) : null,
          currency: bal.currency,
          source: "AA_SETU",
        },
        update: {
          currentBalance: new Prisma.Decimal(bal.currentBalance),
          availableBalance: bal.availableBalance !== undefined ? new Prisma.Decimal(bal.availableBalance) : null,
        },
      });
      await prisma.bankAccount.update({
        where: { id: bankAccountId },
        data: {
          currentBalance: new Prisma.Decimal(bal.currentBalance),
          ...(bal.availableBalance !== undefined
            ? { availableBalance: new Prisma.Decimal(bal.availableBalance) }
            : {}),
        },
      });
      balancesSaved++;
    }

    // 7. Persist transactions — bulk insert, dedup via unique constraint
    const txns = account
      ? fiData.transactions.filter((t) => refToAccountId.get(t.linkRefNumber) === account.id)
      : fiData.transactions;

    const rows = txns
      .map((t) => toTransactionRow(opts.organizationId, refToAccountId, t))
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const inserted = rows.length
      ? await prisma.bankTransaction.createMany({ data: rows, skipDuplicates: true })
      : { count: 0 };

    const txnsSaved = inserted.count;
    const txnsDuplicate = rows.length - inserted.count;

    // 8. Post-sync pipeline (existing engines) per affected account
    const affectedAccountIds = account ? [account.id] : [...new Set(rows.map((r) => r.bankAccountId))];
    if (txnsSaved > 0) {
      for (const accId of affectedAccountIds) {
        await markInDbDuplicates(accId, INCREMENTAL_OVERLAP_DAYS).catch((err) =>
          log.warn("duplicate marking failed", { accId, error: String(err) })
        );
      }
      await bulkCategorize(opts.organizationId).catch((err) =>
        log.warn("categorization failed", { error: String(err) })
      );
      for (const accId of affectedAccountIds) {
        await analyzeRecentTransactions(opts.organizationId, accId, startedAt).catch((err) =>
          log.warn("risk analysis failed", { accId, error: String(err) })
        );
      }
    }
    for (const accId of affectedAccountIds) {
      await updateAccountBalance(accId, opts.organizationId).catch((err) =>
        log.warn("ledger balance update failed", { accId, error: String(err) })
      );
    }

    // 9. Close out history + account sync state
    const status: SyncRunStatus = fiData.status === "PARTIAL" ? "PARTIAL" : "SUCCESS";
    const completedAt = new Date();

    await prisma.$transaction([
      prisma.bankSyncHistory.update({
        where: { id: history.id },
        data: {
          status,
          dataSessionId: fiData.sessionId,
          txnsFetched: fiData.transactions.length,
          txnsSaved,
          txnsDuplicate,
          balancesSaved,
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
        },
      }),
      prisma.bankAccount.updateMany({
        where: { id: { in: affectedAccountIds.length ? affectedAccountIds : accountIds } },
        data: {
          lastSyncAt: completedAt,
          lastSyncStatus: status === "SUCCESS" ? "SUCCESS" : "PARTIAL",
          lastSyncError: null,
          nextSyncAt: new Date(completedAt.getTime() + 6 * 3_600_000),
        },
      }),
      prisma.bankConsent.update({
        where: { id: resolvedConsent.id },
        data: { lastDataFetchAt: completedAt },
      }),
    ]);

    log.info("sync completed", {
      syncHistoryId: history.id,
      status,
      txnsSaved,
      txnsDuplicate,
      balancesSaved,
      accounts: accountIds.length,
      durationMs: completedAt.getTime() - startedAt.getTime(),
    });

    return {
      syncHistoryId: history.id,
      status,
      accountsLinked: accountIds.length,
      txnsFetched: fiData.transactions.length,
      txnsSaved,
      txnsDuplicate,
      balancesSaved,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorCode = err instanceof BankingProviderError ? err.code : "SYNC_ERROR";
    const completedAt = new Date();

    await prisma.bankSyncHistory.update({
      where: { id: history.id },
      data: {
        status: "FAILED",
        error: message.slice(0, 1000),
        errorCode,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
    }).catch(() => {});

    if (account) {
      await prisma.bankAccount.update({
        where: { id: account.id },
        data: { lastSyncStatus: "FAILED", lastSyncError: message.slice(0, 500) },
      }).catch(() => {});
    }

    log.error("sync failed", { syncHistoryId: history.id, errorCode, error: message });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MODE_TO_TXN_TYPE: Record<string, BankTxnType> = {
  UPI: "UPI",
  NEFT: "NEFT",
  RTGS: "RTGS",
  IMPS: "IMPS",
  CHEQUE: "CHEQUE",
  CASH: "CASH",
  ATM: "CASH",
  CARD: "VENDOR_PAYMENT",
  MOBILE_BANKING: "UPI",
  NET_BANKING: "NEFT",
};

function toTransactionRow(
  organizationId: string,
  refToAccountId: Map<string, string>,
  txn: NormalizedTransaction
): Prisma.BankTransactionCreateManyInput | null {
  const bankAccountId = refToAccountId.get(txn.linkRefNumber);
  if (!bankAccountId) return null;

  const isCredit = txn.type === "CREDIT";
  return {
    organizationId,
    bankAccountId,
    externalTxnId: txn.externalId,
    transactionDate: txn.transactionDate,
    valueDate: txn.valueDate ?? null,
    narration: txn.narration || "(no narration)",
    referenceNumber: txn.reference ?? txn.externalId,
    credit: isCredit ? new Prisma.Decimal(txn.amount) : null,
    debit: isCredit ? null : new Prisma.Decimal(txn.amount),
    balance: txn.balanceAfter !== undefined ? new Prisma.Decimal(txn.balanceAfter) : null,
    txnType: MODE_TO_TXN_TYPE[txn.mode] ?? "UNKNOWN",
    source: "AA_SETU",
    status: "UNREVIEWED",
  };
}
