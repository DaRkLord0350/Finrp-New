// ============================================================
// FinRP — TBX Balance mapper
// Normalizes a FetchBalancesResult into the persistence shapes
// balance.service.ts writes: a BankBalance snapshot row and the
// "latest" fields on BankAccount.
// ============================================================

import { Prisma } from "@prisma/client";
import type { FetchBalancesResult } from "./balance.types";

export interface BankBalanceSnapshotData {
  balanceDate: Date;
  currentBalance: Prisma.Decimal;
  availableBalance: Prisma.Decimal | null;
  ledgerBalance: Prisma.Decimal | null;
  currency: string;
}

export interface BankAccountLatestBalanceData {
  currentBalance: Prisma.Decimal;
  availableBalance: Prisma.Decimal;
  ledgerBalance: Prisma.Decimal;
  lastSyncAt: Date;
  lastSyncStatus: "SUCCESS";
  lastSyncError: null;
}

/** Truncate a timestamp to its UTC calendar day, matching BankBalance's per-day snapshot grain. */
function toUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function toBankBalanceSnapshot(result: FetchBalancesResult): BankBalanceSnapshotData {
  if (result.outcome !== "SUCCESS" || result.currentBalance === undefined) {
    throw new Error("Cannot map a failed FetchBalancesResult to a BankBalance snapshot");
  }
  return {
    balanceDate: toUtcDay(result.asOf ?? new Date()),
    currentBalance: new Prisma.Decimal(result.currentBalance),
    availableBalance: result.availableBalance !== undefined ? new Prisma.Decimal(result.availableBalance) : null,
    ledgerBalance: result.ledgerBalance !== undefined ? new Prisma.Decimal(result.ledgerBalance) : null,
    currency: result.currency ?? "INR",
  };
}

export function toBankAccountLatestBalance(result: FetchBalancesResult): BankAccountLatestBalanceData {
  if (result.outcome !== "SUCCESS" || result.currentBalance === undefined) {
    throw new Error("Cannot map a failed FetchBalancesResult to BankAccount latest-balance fields");
  }
  const current = new Prisma.Decimal(result.currentBalance);
  return {
    currentBalance: current,
    availableBalance: result.availableBalance !== undefined ? new Prisma.Decimal(result.availableBalance) : current,
    ledgerBalance: result.ledgerBalance !== undefined ? new Prisma.Decimal(result.ledgerBalance) : current,
    lastSyncAt: result.asOf ?? new Date(),
    lastSyncStatus: "SUCCESS",
    lastSyncError: null,
  };
}
