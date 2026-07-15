// ============================================================
// FinRP — TBX Statement sync
// The core Phase 2B pipeline:
//   fetch → store raw → parse → insert transactions (dedup) →
//   categorize (existing engine) → map to ledger → post
// This is FinRP's primary source of accounting per the brief — no
// CSV, no manual parsing; everything comes from the TBX Statement API.
// Does NOT touch BankAccount.currentBalance/availableBalance/ledgerBalance
// — those are owned by Phase 2A's balance sync (see the note below).
// ============================================================

import { prisma } from "@/lib/prisma";
import { createBankingLogger } from "@/lib/banking/logger";
import { bulkCategorize } from "@/lib/banking/categorization-engine";
import { createCreditJournalEntry, createDebitJournalEntry } from "@/lib/banking/ledger-integration";
import { getTbxStatementProvider } from "./index";
import { parseStatementLines } from "./statement.parser";
import { toBankTransactionRows } from "./statement.mapper";
import { TbxStatementProviderError } from "./statement.types";

const log = createBankingLogger("tbx-statement");

/** How far back to pull on the very first sync for an account. */
const INITIAL_LOOKBACK_DAYS = 90;
/** Overlap window re-fetched on incremental syncs to absorb TBX-side lag. */
const INCREMENTAL_OVERLAP_DAYS = 3;

export interface SyncStatementOutcome {
  status: "SUCCESS" | "FAILED";
  bankAccountId: string;
  rawStatementId?: string;
  txnsFetched: number;
  txnsSaved: number;
  txnsPosted: number;
  error?: string;
  errorCode?: string;
}

export async function syncAccountStatement(
  organizationId: string,
  bankAccountId: string,
  opts: { fromDate?: Date; toDate?: Date } = {}
): Promise<SyncStatementOutcome> {
  const account = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, organizationId, deletedAt: null },
    select: { id: true, lastSyncAt: true },
  });
  if (!account) {
    throw new Error(`Bank account ${bankAccountId} not found in organization ${organizationId}`);
  }

  const now = new Date();
  const toDate = opts.toDate ?? now;
  const fromDate =
    opts.fromDate ??
    (account.lastSyncAt
      ? new Date(account.lastSyncAt.getTime() - INCREMENTAL_OVERLAP_DAYS * 86_400_000)
      : new Date(now.getTime() - INITIAL_LOOKBACK_DAYS * 86_400_000));

  let rawStatementId: string | undefined;

  try {
    const provider = getTbxStatementProvider();
    const result = await provider.fetchStatement({ organizationId, bankAccountId, fromDate, toDate });

    if (result.outcome !== "SUCCESS") {
      throw new TbxStatementProviderError({ message: "TBX reported a failed statement fetch", code: "FETCH_FAILED" });
    }

    const rawStatement = await prisma.rawBankStatement.create({
      data: {
        organizationId,
        bankAccountId,
        fromDate,
        toDate,
        rawJson: result.raw as never,
        status: "FETCHED",
        fetchedAt: new Date(),
      },
      select: { id: true },
    });
    rawStatementId = rawStatement.id;

    const { lines, errors } = parseStatementLines(result.lines);
    if (errors.length > 0) {
      log.warn("statement parse errors", { organizationId, bankAccountId, errorCount: errors.length });
    }

    const rows = toBankTransactionRows(organizationId, bankAccountId, lines);
    const inserted = rows.length ? await prisma.bankTransaction.createMany({ data: rows, skipDuplicates: true }) : { count: 0 };

    await prisma.rawBankStatement.update({
      where: { id: rawStatement.id },
      data: { status: "PARSED", parsedAt: new Date() },
    });

    // Categorize every unreviewed transaction for this account (existing,
    // provider-agnostic BankingRule engine + keyword fallback).
    await bulkCategorize(organizationId).catch((err) =>
      log.warn("categorization failed", { organizationId, bankAccountId, error: String(err) })
    );

    // Post each not-yet-posted transaction on this account to the ledger.
    const toPost = await prisma.bankTransaction.findMany({
      where: { organizationId, bankAccountId, journalEntryId: null },
      select: { id: true, credit: true, debit: true, narration: true, transactionDate: true, txnType: true },
      take: 500,
    });

    let txnsPosted = 0;
    for (const txn of toPost) {
      try {
        const amount = txn.credit ?? txn.debit;
        if (!amount) continue;

        const posted = txn.credit
          ? await createCreditJournalEntry(organizationId, bankAccountId, amount, txn.narration, txn.transactionDate, {
              txnType: txn.txnType,
              entityType: "BANK_TRANSACTION",
              entityId: txn.id,
            })
          : await createDebitJournalEntry(organizationId, bankAccountId, amount, txn.narration, txn.transactionDate, {
              txnType: txn.txnType,
              entityType: "BANK_TRANSACTION",
              entityId: txn.id,
            });

        await prisma.bankTransaction.update({
          where: { id: txn.id },
          data: { journalEntryId: posted.journalId, postedToLedgerAt: new Date() },
        });
        txnsPosted++;
      } catch (err) {
        log.error("ledger posting failed for transaction", { organizationId, bankAccountId, transactionId: txn.id, error: String(err) });
      }
    }

    // Note: deliberately NOT calling updateAccountBalance() here. Phase 2A's
    // balance sync owns BankAccount.currentBalance/availableBalance/ledgerBalance
    // as authoritative values fetched directly from TBX; recomputing them from
    // the internal transaction ledger here would race with that and can
    // silently overwrite a more accurate TBX-reported balance with a locally
    // derived one. This function only affects the double-entry ledger's own
    // per-account Account balance, updated via recomputeAccountBalances()
    // inside createCreditJournalEntry/createDebitJournalEntry above.

    const syncedAt = new Date();
    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: {
        lastSyncAt: syncedAt,
        lastSyncStatus: "SUCCESS",
        lastSyncError: null,
        nextSyncAt: new Date(syncedAt.getTime() + 30 * 60_000),
      },
    });

    log.info("statement synced", { organizationId, bankAccountId, txnsFetched: lines.length, txnsSaved: inserted.count, txnsPosted });
    return {
      status: "SUCCESS",
      bankAccountId,
      rawStatementId,
      txnsFetched: lines.length,
      txnsSaved: inserted.count,
      txnsPosted,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorCode = err instanceof TbxStatementProviderError ? err.code : "SYNC_ERROR";

    if (rawStatementId) {
      await prisma.rawBankStatement
        .update({ where: { id: rawStatementId }, data: { status: "FAILED", errorMessage: message.slice(0, 1000) } })
        .catch(() => {});
    }
    await prisma.bankAccount
      .update({ where: { id: bankAccountId }, data: { lastSyncStatus: "FAILED", lastSyncError: message.slice(0, 500) } })
      .catch(() => {});

    log.error("statement sync failed", { organizationId, bankAccountId, errorCode, error: message });
    return { status: "FAILED", bankAccountId, txnsFetched: 0, txnsSaved: 0, txnsPosted: 0, error: message, errorCode };
  }
}
