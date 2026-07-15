// ============================================================
// FinRP — TBX Balance service
// Orchestration: call the provider (mock or real), persist a
// BankBalance snapshot, update BankAccount's latest balance fields.
// Display-only per Phase 2A scope — no accounting entries, no
// reconciliation, no statement/transaction handling here.
// ============================================================

import { prisma } from "@/lib/prisma";
import { createBankingLogger } from "@/lib/banking/logger";
import { getTbxBalanceProvider } from "./index";
import { toBankAccountLatestBalance, toBankBalanceSnapshot } from "./balance.mapper";
import { TbxBalanceProviderError } from "./balance.types";

const log = createBankingLogger("tbx-balance");

export interface SyncAccountBalanceOutcome {
  status: "SUCCESS" | "FAILED";
  bankAccountId: string;
  error?: string;
  errorCode?: string;
}

/** Fetch and persist the latest balance for one bank account. */
export async function syncAccountBalance(
  organizationId: string,
  bankAccountId: string
): Promise<SyncAccountBalanceOutcome> {
  const account = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, organizationId, deletedAt: null },
    select: { id: true, connectionId: true },
  });
  if (!account) {
    throw new Error(`Bank account ${bankAccountId} not found in organization ${organizationId}`);
  }

  try {
    const provider = getTbxBalanceProvider();
    const result = await provider.fetchBalances({ organizationId, bankAccountId });

    if (result.outcome !== "SUCCESS") {
      throw new TbxBalanceProviderError({ message: "TBX reported a failed balance fetch", code: "FETCH_FAILED" });
    }

    const snapshot = toBankBalanceSnapshot(result);
    const latest = toBankAccountLatestBalance(result);

    await prisma.$transaction([
      prisma.bankBalance.upsert({
        where: {
          bankAccountId_balanceDate_source: {
            bankAccountId,
            balanceDate: snapshot.balanceDate,
            source: "TBX_API",
          },
        },
        create: {
          organizationId,
          bankAccountId,
          balanceDate: snapshot.balanceDate,
          currentBalance: snapshot.currentBalance,
          availableBalance: snapshot.availableBalance,
          ledgerBalance: snapshot.ledgerBalance,
          currency: snapshot.currency,
          source: "TBX_API",
        },
        update: {
          currentBalance: snapshot.currentBalance,
          availableBalance: snapshot.availableBalance,
          ledgerBalance: snapshot.ledgerBalance,
        },
      }),
      prisma.bankAccount.update({
        where: { id: bankAccountId },
        data: {
          currentBalance: latest.currentBalance,
          availableBalance: latest.availableBalance,
          ledgerBalance: latest.ledgerBalance,
          lastSyncAt: latest.lastSyncAt,
          lastSyncStatus: latest.lastSyncStatus,
          lastSyncError: latest.lastSyncError,
          nextSyncAt: new Date(latest.lastSyncAt.getTime() + 30 * 60_000),
        },
      }),
    ]);

    log.info("balance synced", { organizationId, bankAccountId });
    return { status: "SUCCESS", bankAccountId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorCode = err instanceof TbxBalanceProviderError ? err.code : "SYNC_ERROR";

    await prisma.bankAccount
      .update({
        where: { id: bankAccountId },
        data: { lastSyncStatus: "FAILED", lastSyncError: message.slice(0, 500) },
      })
      .catch(() => {});

    log.error("balance sync failed", { organizationId, bankAccountId, errorCode, error: message });
    return { status: "FAILED", bankAccountId, error: message, errorCode };
  }
}

/** Sync every active bank account in an organization. Used by the manual "Sync All" action. */
export async function syncAllAccountBalances(organizationId: string): Promise<SyncAccountBalanceOutcome[]> {
  const accounts = await prisma.bankAccount.findMany({
    where: { organizationId, isActive: true, deletedAt: null },
    select: { id: true },
  });

  const outcomes: SyncAccountBalanceOutcome[] = [];
  for (const account of accounts) {
    outcomes.push(await syncAccountBalance(organizationId, account.id));
  }
  return outcomes;
}
