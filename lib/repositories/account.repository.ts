// ============================================================
// Account (Chart of Accounts) Repository — tenant-scoped data access
// ALL queries filter by organizationId automatically
// ============================================================

import { prisma } from "./base.repository";
import { Prisma, type AccountType } from "@prisma/client";
import type { ListAccountsQuery } from "@/lib/validators/chart-of-accounts";

export type AccountListItem = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  accountSubType: string | null;
  parentAccountId: string | null;
  parentAccount: { id: string; code: string; name: string } | null;
  balance: Prisma.Decimal;
  openingBalance: Prisma.Decimal;
  isActive: boolean;
  isSystemGenerated: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { children: number; journalLines: number };
};

const ACCOUNT_LIST_SELECT = {
  id: true,
  code: true,
  name: true,
  type: true,
  accountSubType: true,
  parentAccountId: true,
  parentAccount: { select: { id: true, code: true, name: true } },
  balance: true,
  openingBalance: true,
  isActive: true,
  isSystemGenerated: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { children: true, journalLines: true } },
} satisfies Prisma.AccountSelect;

const SORT_FIELD: Record<ListAccountsQuery["sortBy"], Prisma.AccountOrderByWithRelationInput> = {
  name: { name: "asc" },
  code: { code: "asc" },
  balance: { balance: "asc" },
  createdAt: { createdAt: "asc" },
};

function buildWhere(organizationId: string, params: ListAccountsQuery): Prisma.AccountWhereInput {
  const { q, type, subType, status, parentAccountId } = params;
  return {
    organizationId,
    deletedAt: null,
    ...(status === "active" && { isActive: true }),
    ...(status === "inactive" && { isActive: false }),
    ...(type && { type }),
    ...(subType && { accountSubType: subType }),
    ...(parentAccountId !== undefined && { parentAccountId: parentAccountId || null }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
      ],
    }),
  };
}

export const accountRepository = {
  async list(
    organizationId: string,
    params: ListAccountsQuery
  ): Promise<{ data: AccountListItem[]; total: number; page: number; pageSize: number }> {
    const where = buildWhere(organizationId, params);
    const orderBy = applyDirection(SORT_FIELD[params.sortBy], params.sortDir);

    const [data, total] = await Promise.all([
      prisma.account.findMany({
        where,
        select: ACCOUNT_LIST_SELECT,
        orderBy,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.account.count({ where }),
    ]);

    return { data: data as AccountListItem[], total, page: params.page, pageSize: params.pageSize };
  },

  async findById(organizationId: string, id: string) {
    return prisma.account.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: {
        ...ACCOUNT_LIST_SELECT,
        description: true,
        createdBy: true,
        updatedBy: true,
      },
    });
  },

  async findByCode(organizationId: string, code: string) {
    return prisma.account.findFirst({
      where: { organizationId, code, deletedAt: null },
    });
  },

  async findManyByIds(organizationId: string, ids: string[]) {
    return prisma.account.findMany({
      where: { organizationId, id: { in: ids }, deletedAt: null },
    });
  },

  /** Lightweight list for parent-account / posting-account dropdowns. */
  async listForSelect(organizationId: string, opts: { activeOnly?: boolean } = {}) {
    return prisma.account.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(opts.activeOnly !== false && { isActive: true }),
      },
      select: { id: true, code: true, name: true, type: true, accountSubType: true, parentAccountId: true },
      orderBy: { code: "asc" },
      take: 5000,
    });
  },

  /** Full active tree projection — used to build the hierarchy view server-side. */
  async listForTree(organizationId: string) {
    return prisma.account.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        accountSubType: true,
        parentAccountId: true,
        balance: true,
        isActive: true,
        isSystemGenerated: true,
      },
      orderBy: { code: "asc" },
      take: 20_000,
    });
  },

  async create(
    organizationId: string,
    data: {
      code: string;
      name: string;
      type: AccountType;
      accountSubType?: string | null;
      parentAccountId?: string | null;
      description?: string | null;
      openingBalance: number;
      createdBy?: string | null;
    }
  ) {
    return prisma.account.create({
      data: {
        organizationId,
        code: data.code,
        name: data.name,
        type: data.type,
        accountSubType: data.accountSubType ?? null,
        parentAccountId: data.parentAccountId ?? null,
        description: data.description ?? null,
        openingBalance: data.openingBalance,
        balance: data.openingBalance,
        createdBy: data.createdBy ?? null,
        updatedBy: data.createdBy ?? null,
      },
    });
  },

  /** Caller must have already verified tenant ownership (e.g. via findById). */
  async update(organizationId: string, id: string, data: Prisma.AccountUpdateInput) {
    const owned = await prisma.account.findFirst({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
    if (!owned) return null;
    return prisma.account.update({ where: { id }, data });
  },

  async setActiveStatus(organizationId: string, id: string, isActive: boolean, updatedBy?: string | null) {
    return prisma.account.updateMany({
      where: { id, organizationId },
      data: { isActive, updatedBy: updatedBy ?? null },
    });
  },

  async bulkSetActiveStatus(organizationId: string, ids: string[], isActive: boolean, updatedBy?: string | null) {
    return prisma.account.updateMany({
      where: { id: { in: ids }, organizationId, isSystemGenerated: false },
      data: { isActive, updatedBy: updatedBy ?? null },
    });
  },

  async softDelete(organizationId: string, id: string, updatedBy?: string | null) {
    return prisma.account.updateMany({
      where: { id, organizationId },
      data: { isActive: false, deletedAt: new Date(), updatedBy: updatedBy ?? null },
    });
  },

  async hasJournalLines(organizationId: string, id: string): Promise<boolean> {
    const count = await prisma.journalLine.count({
      where: { accountId: id, journalEntry: { organizationId, deletedAt: null } },
    });
    return count > 0;
  },

  async hasChildren(organizationId: string, id: string): Promise<boolean> {
    const count = await prisma.account.count({
      where: { parentAccountId: id, organizationId, deletedAt: null },
    });
    return count > 0;
  },

  /**
   * Per-account-type rollup for the accounting dashboard:
   * opening balances (from accounts) + posted ledger movement (from journal lines).
   * Kept as two aggregates so the journal-line JOIN never multiplies opening balances.
   * NOTE: once JournalEntry.status exists (Phase 1) the movement query filters POSTED.
   */
  async getTypeRollup(organizationId: string): Promise<{
    openings: { type: AccountType; opening: Prisma.Decimal; count: number }[];
    movements: { type: AccountType; debit: Prisma.Decimal; credit: Prisma.Decimal }[];
  }> {
    const [openingRows, movementRows] = await Promise.all([
      prisma.account.groupBy({
        by: ["type"],
        where: { organizationId, deletedAt: null },
        _sum: { openingBalance: true },
        _count: { _all: true },
      }),
      prisma.$queryRaw<{ type: AccountType; debit: string; credit: string }[]>`
        SELECT a.type AS type,
          COALESCE(SUM(CASE WHEN jl.type = 'DEBIT'  THEN jl.amount ELSE 0 END), 0)::text AS debit,
          COALESCE(SUM(CASE WHEN jl.type = 'CREDIT' THEN jl.amount ELSE 0 END), 0)::text AS credit
        FROM accounts a
        JOIN journal_lines jl   ON jl."accountId" = a.id
        JOIN journal_entries je  ON je.id = jl."journalEntryId"
          AND je."organizationId" = ${organizationId}
          AND je."deletedAt" IS NULL
        WHERE a."organizationId" = ${organizationId}
          AND a."deletedAt" IS NULL
        GROUP BY a.type
      `,
    ]);

    return {
      openings: openingRows.map((r) => ({
        type: r.type,
        opening: r._sum.openingBalance ?? new Prisma.Decimal(0),
        count: r._count._all,
      })),
      movements: movementRows.map((r) => ({
        type: r.type,
        debit: new Prisma.Decimal(r.debit),
        credit: new Prisma.Decimal(r.credit),
      })),
    };
  },

  /** Active / inactive account counts for the dashboard. */
  async countByStatus(organizationId: string): Promise<{ active: number; inactive: number; total: number }> {
    const [active, total] = await Promise.all([
      prisma.account.count({ where: { organizationId, deletedAt: null, isActive: true } }),
      prisma.account.count({ where: { organizationId, deletedAt: null } }),
    ]);
    return { active, inactive: total - active, total };
  },

  /** Sum of journal-line debits/credits for an account within an optional date range. */
  async getLedgerActivity(organizationId: string, id: string, range?: { from?: Date; to?: Date }) {
    const lines = await prisma.journalLine.findMany({
      where: {
        accountId: id,
        journalEntry: {
          organizationId,
          deletedAt: null,
          ...(range?.from || range?.to
            ? { entryDate: { ...(range.from && { gte: range.from }), ...(range.to && { lte: range.to }) } }
            : {}),
        },
      },
      select: { type: true, amount: true },
    });

    let debit = new Prisma.Decimal(0);
    let credit = new Prisma.Decimal(0);
    for (const line of lines) {
      if (line.type === "DEBIT") debit = debit.add(line.amount);
      else credit = credit.add(line.amount);
    }
    return { debit, credit };
  },
};

function applyDirection(
  order: Prisma.AccountOrderByWithRelationInput,
  dir: "asc" | "desc"
): Prisma.AccountOrderByWithRelationInput {
  const [key] = Object.entries(order)[0] as [string, "asc" | "desc"];
  return { [key]: dir } as Prisma.AccountOrderByWithRelationInput;
}
