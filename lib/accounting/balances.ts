// ============================================================
// Account balance maintenance
//
// `Account.balance` is stored in the account's NORMAL direction
// (positive = normal side), consistent with `openingBalance`:
//   balance = openingBalance + posted movement (normalized by type)
//
// Only POSTED, non-deleted journal entries contribute. Recompute is
// idempotent and tx-aware so it can run atomically with a posting.
// ============================================================

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalBalanceForType } from "@/lib/services/accounting.service";

type Client = Prisma.TransactionClient | typeof prisma;

const ZERO = new Prisma.Decimal(0);

/**
 * Recompute and persist a single account's balance from its posted ledger
 * activity. Returns the new balance (normal-signed).
 */
export async function recomputeAccountBalance(
  client: Client,
  organizationId: string,
  accountId: string
): Promise<Prisma.Decimal> {
  const account = await client.account.findFirst({
    where: { id: accountId, organizationId },
    select: { openingBalance: true, type: true },
  });
  if (!account) return ZERO;

  const agg = await client.journalLine.groupBy({
    by: ["type"],
    where: {
      accountId,
      journalEntry: { organizationId, status: "POSTED", deletedAt: null },
    },
    _sum: { amount: true },
  });

  let debit = ZERO;
  let credit = ZERO;
  for (const row of agg) {
    if (row.type === "DEBIT") debit = new Prisma.Decimal(row._sum.amount ?? 0);
    else credit = new Prisma.Decimal(row._sum.amount ?? 0);
  }

  const movement =
    normalBalanceForType(account.type) === "DEBIT" ? debit.sub(credit) : credit.sub(debit);
  const balance = new Prisma.Decimal(account.openingBalance).add(movement);

  await client.account.update({ where: { id: accountId }, data: { balance } });
  return balance;
}

/**
 * Recompute balances for many accounts (e.g. all accounts touched by a posting).
 */
export async function recomputeAccountBalances(
  client: Client,
  organizationId: string,
  accountIds: string[]
): Promise<void> {
  for (const id of Array.from(new Set(accountIds))) {
    await recomputeAccountBalance(client, organizationId, id);
  }
}

/**
 * One-shot backfill — recompute every account in an organization.
 * Used after the manual-journals migration to align the `balance` column.
 */
export async function recomputeAllAccountBalances(organizationId: string): Promise<number> {
  const accounts = await prisma.account.findMany({
    where: { organizationId, deletedAt: null },
    select: { id: true },
  });
  for (const a of accounts) {
    await recomputeAccountBalance(prisma, organizationId, a.id);
  }
  return accounts.length;
}
