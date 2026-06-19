// ============================================================
// Journal (Manual Journals / ledger) Repository — tenant-scoped reads
// ALL queries filter by organizationId.
// ============================================================

import { prisma } from "./base.repository";
import { Prisma } from "@prisma/client";
import type { ListJournalsQuery } from "@/lib/validators/journal";

const LIST_SELECT = {
  id: true,
  journalNumber: true,
  status: true,
  journalType: true,
  entryDate: true,
  reference: true,
  description: true,
  source: true,
  currency: true,
  totalDebit: true,
  totalCredit: true,
  createdAt: true,
  createdByUser: { select: { name: true, email: true } },
  _count: { select: { lines: true } },
} satisfies Prisma.JournalEntrySelect;

const SORT_FIELD: Record<ListJournalsQuery["sortBy"], keyof Prisma.JournalEntryOrderByWithRelationInput> = {
  entryDate: "entryDate",
  journalNumber: "journalNumber",
  createdAt: "createdAt",
  totalDebit: "totalDebit",
};

function buildWhere(organizationId: string, params: ListJournalsQuery): Prisma.JournalEntryWhereInput {
  const { q, status, journalType, from, to } = params;
  return {
    organizationId,
    deletedAt: null,
    ...(status && { status }),
    ...(journalType && { journalType }),
    ...((from || to) && {
      entryDate: { ...(from && { gte: from }), ...(to && { lte: to }) },
    }),
    ...(q && {
      OR: [
        { journalNumber: { contains: q, mode: "insensitive" } },
        { reference: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    }),
  };
}

export const journalRepository = {
  async list(organizationId: string, params: ListJournalsQuery) {
    const where = buildWhere(organizationId, params);
    const [data, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { [SORT_FIELD[params.sortBy]]: params.sortDir },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.journalEntry.count({ where }),
    ]);
    return { data, total, page: params.page, pageSize: params.pageSize };
  },

  async findById(organizationId: string, id: string) {
    return prisma.journalEntry.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        lines: {
          orderBy: { lineOrder: "asc" },
          include: { account: { select: { id: true, code: true, name: true, type: true } } },
        },
        createdByUser: { select: { name: true, email: true } },
        postedByUser: { select: { name: true, email: true } },
        reversalOf: { select: { id: true, journalNumber: true } },
        reversals: { select: { id: true, journalNumber: true } },
      },
    });
  },

  /** Status counts for the accounting dashboard. */
  async countByStatus(organizationId: string) {
    const rows = await prisma.journalEntry.groupBy({
      by: ["status"],
      where: { organizationId, deletedAt: null },
      _count: { _all: true },
    });
    const out = { DRAFT: 0, POSTED: 0, VOID: 0 } as Record<string, number>;
    for (const r of rows) out[r.status] = r._count._all;
    return out;
  },
};
