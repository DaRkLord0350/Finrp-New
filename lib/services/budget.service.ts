// ============================================================
// Budget Service — CRUD + budget-vs-actual variance.
// Actuals are derived from POSTED journal lines, normalized to each
// account's natural direction so they compare directly to the budget.
// ============================================================

import { Prisma, type AccountType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { normalBalanceForType } from "@/lib/services/accounting.service";
import { dateToPeriodIndex, periodCount, periodLabels, type BudgetGranularity } from "@/lib/accounting/budget-periods";

class BudgetError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message);
    this.name = "BudgetError";
  }
}
export { BudgetError };

type Actor = { userId: string | null };

export const budgetService = {
  list(organizationId: string) {
    return prisma.budget.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: { fiscalYear: { select: { name: true, startDate: true, endDate: true } }, _count: { select: { lines: true } } },
    });
  },

  async getById(organizationId: string, id: string) {
    const budget = await prisma.budget.findFirst({
      where: { id, organizationId },
      include: {
        fiscalYear: { select: { name: true, startDate: true, endDate: true } },
        lines: true,
      },
    });
    if (!budget) throw new BudgetError("Budget not found", 404);
    return budget;
  },

  async create(organizationId: string, actor: Actor, input: { name: string; fiscalYearId: string; granularity: BudgetGranularity }) {
    const fy = await prisma.fiscalYear.findFirst({ where: { id: input.fiscalYearId, organizationId }, select: { id: true } });
    if (!fy) throw new BudgetError("Fiscal year not found", 404);

    const dup = await prisma.budget.findFirst({ where: { organizationId, fiscalYearId: input.fiscalYearId, name: input.name.trim() }, select: { id: true } });
    if (dup) throw new BudgetError("A budget with this name already exists for the fiscal year", 409);

    const budget = await prisma.budget.create({
      data: {
        organizationId,
        fiscalYearId: input.fiscalYearId,
        name: input.name.trim(),
        granularity: input.granularity,
        createdById: actor.userId,
      },
    });

    await createAuditLog({
      organizationId, userId: actor.userId ?? undefined, action: "CREATE", entity: "budget", entityId: budget.id,
      description: `Created budget "${budget.name}"`,
    });
    return budget;
  },

  async update(organizationId: string, actor: Actor, id: string, input: { name?: string; status?: "DRAFT" | "ACTIVE" | "ARCHIVED" }) {
    const existing = await prisma.budget.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!existing) throw new BudgetError("Budget not found", 404);

    const budget = await prisma.budget.update({
      where: { id },
      data: { ...(input.name !== undefined && { name: input.name.trim() }), ...(input.status !== undefined && { status: input.status }) },
    });
    await createAuditLog({
      organizationId, userId: actor.userId ?? undefined, action: "UPDATE", entity: "budget", entityId: id,
      description: `Updated budget "${budget.name}"`,
    });
    return budget;
  },

  async remove(organizationId: string, actor: Actor, id: string) {
    const existing = await prisma.budget.findFirst({ where: { id, organizationId }, select: { id: true, name: true } });
    if (!existing) throw new BudgetError("Budget not found", 404);
    await prisma.budget.delete({ where: { id } });
    await createAuditLog({
      organizationId, userId: actor.userId ?? undefined, action: "DELETE", entity: "budget", entityId: id,
      description: `Deleted budget "${existing.name}"`,
    });
  },

  /** Replace all budget lines (the grid editor sends the full set). */
  async setLines(organizationId: string, actor: Actor, id: string, lines: { accountId: string; periodIndex: number; amount: number }[]) {
    const budget = await prisma.budget.findFirst({ where: { id, organizationId }, select: { id: true, granularity: true } });
    if (!budget) throw new BudgetError("Budget not found", 404);

    const maxIndex = periodCount(budget.granularity as BudgetGranularity) - 1;
    // Keep only non-zero amounts within the valid period range; collapse dupes.
    const filtered = lines.filter((l) => l.periodIndex >= 0 && l.periodIndex <= maxIndex && Number.isFinite(l.amount) && Math.abs(l.amount) >= 0.005);

    // Verify all referenced accounts belong to the org.
    const accountIds = [...new Set(filtered.map((l) => l.accountId))];
    if (accountIds.length) {
      const owned = await prisma.account.count({ where: { id: { in: accountIds }, organizationId, deletedAt: null } });
      if (owned !== accountIds.length) throw new BudgetError("One or more accounts are invalid", 422);
    }

    await prisma.$transaction(async (tx) => {
      await tx.budgetLine.deleteMany({ where: { budgetId: id } });
      if (filtered.length) {
        await tx.budgetLine.createMany({
          data: filtered.map((l) => ({ budgetId: id, accountId: l.accountId, periodIndex: l.periodIndex, amount: new Prisma.Decimal(l.amount) })),
        });
      }
    });

    await createAuditLog({
      organizationId, userId: actor.userId ?? undefined, action: "UPDATE", entity: "budget", entityId: id,
      description: `Updated ${filtered.length} budget line(s)`,
    });
    return this.getById(organizationId, id);
  },

  /** Budget vs actual per account/period for the budget's fiscal year. */
  async vsActual(organizationId: string, id: string) {
    const budget = await this.getById(organizationId, id);
    const granularity = budget.granularity as BudgetGranularity;
    const fyStart = new Date(budget.fiscalYear.startDate);
    const fyEnd = new Date(budget.fiscalYear.endDate);
    const nPeriods = periodCount(granularity);
    const labels = periodLabels(granularity, fyStart);

    // accounts referenced by the budget
    const accountIds = [...new Set(budget.lines.map((l) => l.accountId))];
    const accounts = accountIds.length
      ? await prisma.account.findMany({ where: { id: { in: accountIds }, organizationId }, select: { id: true, code: true, name: true, type: true } })
      : [];
    const accountById = new Map(accounts.map((a) => [a.id, a]));

    // budget map: accountId -> periodIndex -> amount
    const budgetMap = new Map<string, number[]>();
    for (const a of accounts) budgetMap.set(a.id, Array(nPeriods).fill(0));
    for (const l of budget.lines) {
      const arr = budgetMap.get(l.accountId);
      if (arr && l.periodIndex < nPeriods) arr[l.periodIndex] = Number(l.amount);
    }

    // actuals from posted journal lines within the fiscal year for these accounts
    const actualMap = new Map<string, number[]>();
    for (const a of accounts) actualMap.set(a.id, Array(nPeriods).fill(0));
    if (accountIds.length) {
      const lines = await prisma.journalLine.findMany({
        where: {
          accountId: { in: accountIds },
          journalEntry: { organizationId, deletedAt: null, status: "POSTED", entryDate: { gte: fyStart, lte: fyEnd } },
        },
        select: { accountId: true, type: true, amount: true, journalEntry: { select: { entryDate: true } } },
      });
      for (const ln of lines) {
        const acct = accountById.get(ln.accountId);
        if (!acct) continue;
        const idx = dateToPeriodIndex(new Date(ln.journalEntry.entryDate), fyStart, granularity);
        const normal = normalBalanceForType(acct.type as AccountType);
        const signed = (ln.type === "DEBIT" ? 1 : -1) * (normal === "DEBIT" ? 1 : -1) * Number(ln.amount);
        const arr = actualMap.get(ln.accountId)!;
        arr[idx] += signed;
      }
    }

    const rows = accounts.map((a) => {
      const budgeted = budgetMap.get(a.id) ?? Array(nPeriods).fill(0);
      const actual = (actualMap.get(a.id) ?? Array(nPeriods).fill(0)).map((v) => Math.round(v * 100) / 100);
      const totalBudget = budgeted.reduce((s, v) => s + v, 0);
      const totalActual = actual.reduce((s, v) => s + v, 0);
      return {
        accountId: a.id,
        accountCode: a.code,
        accountName: a.name,
        accountType: a.type,
        budgeted,
        actual,
        totalBudget: Math.round(totalBudget * 100) / 100,
        totalActual: Math.round(totalActual * 100) / 100,
        variance: Math.round((totalActual - totalBudget) * 100) / 100,
        variancePct: totalBudget !== 0 ? Math.round(((totalActual - totalBudget) / Math.abs(totalBudget)) * 10000) / 100 : null,
      };
    });

    return {
      budget: { id: budget.id, name: budget.name, granularity, status: budget.status, fiscalYear: budget.fiscalYear.name },
      periodLabels: labels,
      rows,
      totals: {
        budget: Math.round(rows.reduce((s, r) => s + r.totalBudget, 0) * 100) / 100,
        actual: Math.round(rows.reduce((s, r) => s + r.totalActual, 0) * 100) / 100,
      },
    };
  },
};
