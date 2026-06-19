// ============================================================
// Accounting period guard + fiscal-period resolution
//
// `assertPostingAllowed` is the single chokepoint every posting path
// (manual journals, document→ledger posting, reversals) calls before
// writing to the ledger on a given date. It enforces:
//   - AccountingSettings.lockDate (books locked on/before a date)
//   - FiscalPeriod status (CLOSED / LOCKED periods reject postings)
// An actor holding `accounting.manage` (canOverride) bypasses both.
// ============================================================

import { prisma } from "@/lib/prisma";

export class PeriodLockedError extends Error {
  constructor(message: string, readonly status: number = 422) {
    super(message);
    this.name = "PeriodLockedError";
  }
}

export interface PostingGuardOptions {
  /** Effective role of the actor; an `accounting.manage` holder may override a lock. */
  canOverride?: boolean;
}

/** Resolve (and lazily create the default row for) an org's accounting settings. */
export async function getAccountingSettings(organizationId: string) {
  const existing = await prisma.accountingSettings.findUnique({ where: { organizationId } });
  if (existing) return existing;
  return prisma.accountingSettings.create({ data: { organizationId } });
}

/** Find the fiscal year + period covering a date (or nulls when none defined). */
export async function resolveFiscalPeriod(
  organizationId: string,
  date: Date
): Promise<{ fiscalYearId: string | null; fiscalPeriodId: string | null }> {
  const period = await prisma.fiscalPeriod.findFirst({
    where: {
      organizationId,
      startDate: { lte: date },
      endDate: { gte: date },
    },
    select: { id: true, fiscalYearId: true },
  });
  return {
    fiscalYearId: period?.fiscalYearId ?? null,
    fiscalPeriodId: period?.id ?? null,
  };
}

/**
 * Throws PeriodLockedError when posting on `date` is not permitted.
 */
export async function assertPostingAllowed(
  organizationId: string,
  date: Date,
  opts: PostingGuardOptions = {}
): Promise<void> {
  if (opts.canOverride) return;

  const settings = await prisma.accountingSettings.findUnique({
    where: { organizationId },
    select: { lockDate: true },
  });

  if (settings?.lockDate && date <= settings.lockDate) {
    throw new PeriodLockedError(
      `The books are locked through ${settings.lockDate.toISOString().slice(0, 10)}. Posting on ${date
        .toISOString()
        .slice(0, 10)} is not allowed.`
    );
  }

  const period = await prisma.fiscalPeriod.findFirst({
    where: { organizationId, startDate: { lte: date }, endDate: { gte: date } },
    select: { name: true, status: true },
  });

  if (period && period.status !== "OPEN") {
    throw new PeriodLockedError(
      `Fiscal period "${period.name}" is ${period.status.toLowerCase()} and cannot accept postings.`
    );
  }
}
