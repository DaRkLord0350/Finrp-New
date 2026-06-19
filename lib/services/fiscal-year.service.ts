// ============================================================
// Fiscal Year Service
//   - create a fiscal year + its monthly periods
//   - close a year: post a CLOSING journal that zeroes P&L accounts
//     into Retained Earnings, then lock the year's periods
//   - reopen a year, lock/unlock individual periods
// All writes are audited; closing posts a real, balanced journal.
// ============================================================

import { Prisma, type AccountType, type FiscalPeriodStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { generateNextJournalNumber } from "@/lib/generators/journal-number";
import { recomputeAccountBalances } from "@/lib/accounting/balances";
import { getAccountingSettings } from "@/lib/accounting/period";
import { normalBalanceForType } from "@/lib/services/accounting.service";

class FiscalYearError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message);
    this.name = "FiscalYearError";
  }
}
export { FiscalYearError };

type Actor = { userId: string | null };

function monthName(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Build month-aligned periods spanning [start, end]. */
function buildPeriods(start: Date, end: Date): { name: string; periodNumber: number; startDate: Date; endDate: Date }[] {
  const periods: { name: string; periodNumber: number; startDate: Date; endDate: Date }[] = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  let n = 1;
  while (cursor <= end && n <= 24) {
    const pStart = n === 1 ? new Date(start) : new Date(cursor);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    const pEnd = monthEnd > end ? new Date(end) : monthEnd;
    periods.push({ name: monthName(cursor), periodNumber: n, startDate: pStart, endDate: pEnd });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    n++;
  }
  return periods;
}

export const fiscalYearService = {
  list(organizationId: string) {
    return prisma.fiscalYear.findMany({
      where: { organizationId },
      orderBy: { startDate: "desc" },
      include: { _count: { select: { periods: true } } },
    });
  },

  async getById(organizationId: string, id: string) {
    const fy = await prisma.fiscalYear.findFirst({
      where: { id, organizationId },
      include: { periods: { orderBy: { periodNumber: "asc" } } },
    });
    if (!fy) throw new FiscalYearError("Fiscal year not found", 404);
    return fy;
  },

  async create(organizationId: string, actor: Actor, input: { name: string; startDate: Date; endDate: Date }) {
    if (input.endDate <= input.startDate) throw new FiscalYearError("End date must be after start date", 422);

    const overlap = await prisma.fiscalYear.findFirst({
      where: {
        organizationId,
        startDate: { lte: input.endDate },
        endDate: { gte: input.startDate },
      },
      select: { name: true },
    });
    if (overlap) throw new FiscalYearError(`Dates overlap existing fiscal year "${overlap.name}"`, 409);

    const periods = buildPeriods(input.startDate, input.endDate);

    const fy = await prisma.fiscalYear.create({
      data: {
        organizationId,
        name: input.name.trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        periods: {
          create: periods.map((p) => ({
            organizationId,
            name: p.name,
            periodNumber: p.periodNumber,
            startDate: p.startDate,
            endDate: p.endDate,
          })),
        },
      },
      include: { periods: { orderBy: { periodNumber: "asc" } } },
    });

    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "CREATE",
      entity: "fiscal_year",
      entityId: fy.id,
      description: `Created fiscal year "${fy.name}" with ${periods.length} periods`,
    });

    return fy;
  },

  /** Preview the closing entry without posting (for the UI confirmation). */
  async previewClose(organizationId: string, id: string) {
    const fy = await prisma.fiscalYear.findFirst({ where: { id, organizationId } });
    if (!fy) throw new FiscalYearError("Fiscal year not found", 404);
    const { lines, netIncome } = await this.buildClosingLines(organizationId, fy.endDate);
    return { fiscalYear: fy, lineCount: lines.length, netIncome };
  },

  /** Compute the P&L-zeroing journal lines as of a date. */
  async buildClosingLines(organizationId: string, asOf: Date) {
    const rows = await prisma.$queryRaw<{
      account_id: string;
      account_type: AccountType;
      opening: string;
      debit: string;
      credit: string;
    }[]>`
      SELECT a.id AS account_id, a.type AS account_type, a."openingBalance"::text AS opening,
        COALESCE(SUM(CASE WHEN jl.type = 'DEBIT'  THEN jl.amount ELSE 0 END), 0)::text AS debit,
        COALESCE(SUM(CASE WHEN jl.type = 'CREDIT' THEN jl.amount ELSE 0 END), 0)::text AS credit
      FROM accounts a
      LEFT JOIN journal_lines jl ON jl."accountId" = a.id
      LEFT JOIN journal_entries je
        ON je.id = jl."journalEntryId" AND je."organizationId" = ${organizationId}
        AND je."deletedAt" IS NULL AND je.status = 'POSTED' AND je."entryDate" <= ${asOf}
      WHERE a."organizationId" = ${organizationId} AND a."deletedAt" IS NULL
        AND a.type IN ('INCOME', 'EXPENSE', 'COGS')
      GROUP BY a.id, a.type, a."openingBalance"
    `;

    const lines: { accountId: string; type: "DEBIT" | "CREDIT"; amount: Prisma.Decimal; description: string }[] = [];
    let sumDebit = new Prisma.Decimal(0);
    let sumCredit = new Prisma.Decimal(0);

    for (const r of rows) {
      const opening = new Prisma.Decimal(r.opening);
      const debit = new Prisma.Decimal(r.debit);
      const credit = new Prisma.Decimal(r.credit);
      const normal = normalBalanceForType(r.account_type);
      const endingNormal = opening.add(normal === "DEBIT" ? debit.sub(credit) : credit.sub(debit));
      if (endingNormal.abs().lt(new Prisma.Decimal("0.005"))) continue;

      // Post the opposite of the account's normal ending to zero it out.
      if (normal === "CREDIT") {
        // income-type: zero a credit balance with a debit
        if (endingNormal.gt(0)) { lines.push({ accountId: r.account_id, type: "DEBIT", amount: endingNormal, description: "Year-end close" }); sumDebit = sumDebit.add(endingNormal); }
        else { const amt = endingNormal.abs(); lines.push({ accountId: r.account_id, type: "CREDIT", amount: amt, description: "Year-end close" }); sumCredit = sumCredit.add(amt); }
      } else {
        // expense/cogs-type: zero a debit balance with a credit
        if (endingNormal.gt(0)) { lines.push({ accountId: r.account_id, type: "CREDIT", amount: endingNormal, description: "Year-end close" }); sumCredit = sumCredit.add(endingNormal); }
        else { const amt = endingNormal.abs(); lines.push({ accountId: r.account_id, type: "DEBIT", amount: amt, description: "Year-end close" }); sumDebit = sumDebit.add(amt); }
      }
    }

    // Net income flows to Retained Earnings as the balancing line.
    const netIncome = sumDebit.sub(sumCredit); // debits to income − credits to expense ≈ profit
    return { lines, sumDebit, sumCredit, netIncome };
  },

  async resolveRetainedEarningsAccountId(organizationId: string): Promise<string> {
    const settings = await getAccountingSettings(organizationId);
    if (settings.retainedEarningsAccountId) return settings.retainedEarningsAccountId;
    const byCode = await prisma.account.findFirst({
      where: { organizationId, code: "3100", deletedAt: null },
      select: { id: true },
    });
    if (byCode) return byCode.id;
    const byType = await prisma.account.findFirst({
      where: { organizationId, type: "EQUITY", accountSubType: "Retained Earnings", deletedAt: null },
      select: { id: true },
    });
    if (byType) return byType.id;
    throw new FiscalYearError("No Retained Earnings account found — create one (e.g. code 3100) or set it in Accounting settings", 422);
  },

  async close(organizationId: string, actor: Actor, id: string) {
    const fy = await prisma.fiscalYear.findFirst({ where: { id, organizationId } });
    if (!fy) throw new FiscalYearError("Fiscal year not found", 404);
    if (fy.status === "CLOSED") throw new FiscalYearError("Fiscal year is already closed", 422);

    const reAccountId = await this.resolveRetainedEarningsAccountId(organizationId);
    const { lines, sumDebit, sumCredit, netIncome } = await this.buildClosingLines(organizationId, fy.endDate);

    const allLines = [...lines];
    if (!netIncome.abs().lt(new Prisma.Decimal("0.005"))) {
      if (netIncome.gt(0)) allLines.push({ accountId: reAccountId, type: "CREDIT", amount: netIncome, description: "Net income to Retained Earnings" });
      else allLines.push({ accountId: reAccountId, type: "DEBIT", amount: netIncome.abs(), description: "Net loss to Retained Earnings" });
    }

    const totalDebit = netIncome.gt(0) ? sumDebit : sumDebit.add(netIncome.abs());
    const totalCredit = netIncome.gt(0) ? sumCredit.add(netIncome) : sumCredit;

    const result = await prisma.$transaction(async (tx) => {
      let closingJournalId: string | null = null;
      if (allLines.length >= 2) {
        const journalNumber = await generateNextJournalNumber(organizationId, { client: tx });
        const closing = await tx.journalEntry.create({
          data: {
            organizationId,
            journalNumber,
            status: "POSTED",
            journalType: "CLOSING",
            reference: `CLOSE-${fy.name}`,
            description: `Year-end closing for ${fy.name}`,
            entryDate: fy.endDate,
            totalDebit,
            totalCredit,
            createdById: actor.userId,
            postedById: actor.userId,
            postedAt: new Date(),
            fiscalYearId: fy.id,
            lines: { create: allLines.map((l, i) => ({ accountId: l.accountId, type: l.type, amount: l.amount, description: l.description, lineOrder: i })) },
          },
          select: { id: true },
        });
        closingJournalId = closing.id;
        await recomputeAccountBalances(tx, organizationId, allLines.map((l) => l.accountId));
      }

      await tx.fiscalPeriod.updateMany({ where: { fiscalYearId: fy.id }, data: { status: "LOCKED" } });
      await tx.fiscalYear.update({
        where: { id: fy.id },
        data: { status: "CLOSED", closedAt: new Date(), closedById: actor.userId, closingJournalId },
      });
      return { closingJournalId };
    });

    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "CLOSE",
      entity: "fiscal_year",
      entityId: fy.id,
      description: `Closed fiscal year "${fy.name}" (net income ${netIncome.toFixed(2)})`,
      newValue: { netIncome: netIncome.toFixed(2), closingJournalId: result.closingJournalId },
    });

    return this.getById(organizationId, id);
  },

  async reopen(organizationId: string, actor: Actor, id: string) {
    const fy = await prisma.fiscalYear.findFirst({ where: { id, organizationId } });
    if (!fy) throw new FiscalYearError("Fiscal year not found", 404);
    if (fy.status === "OPEN") throw new FiscalYearError("Fiscal year is already open", 422);

    await prisma.$transaction(async (tx) => {
      await tx.fiscalPeriod.updateMany({ where: { fiscalYearId: fy.id }, data: { status: "OPEN" } });
      await tx.fiscalYear.update({ where: { id: fy.id }, data: { status: "OPEN", closedAt: null, closedById: null } });
    });

    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "UPDATE",
      entity: "fiscal_year",
      entityId: fy.id,
      description: `Reopened fiscal year "${fy.name}" (closing journal ${fy.closingJournalId ?? "none"} left in place)`,
    });

    return this.getById(organizationId, id);
  },

  async setPeriodStatus(organizationId: string, actor: Actor, periodId: string, status: FiscalPeriodStatus) {
    const period = await prisma.fiscalPeriod.findFirst({ where: { id: periodId, organizationId } });
    if (!period) throw new FiscalYearError("Fiscal period not found", 404);

    await prisma.fiscalPeriod.update({ where: { id: periodId }, data: { status } });

    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "LOCK",
      entity: "fiscal_period",
      entityId: periodId,
      description: `Set period "${period.name}" to ${status}`,
    });

    return prisma.fiscalPeriod.findUnique({ where: { id: periodId } });
  },
};
