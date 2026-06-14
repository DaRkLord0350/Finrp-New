// ============================================================
// Invoice Repository — tenant-scoped data access
// ============================================================

import { prisma, paginate, clampTake, type PaginatedResult } from "./base.repository";
import { Prisma } from "@prisma/client";

export type InvoiceListItem = {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: Date;
  dueDate: Date;
  total: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  balanceDue: Prisma.Decimal;
  currency: string;
  customer: { id: string; name: string; company: string | null };
};

const INVOICE_LIST_SELECT = {
  id: true,
  invoiceNumber: true,
  status: true,
  issueDate: true,
  dueDate: true,
  total: true,
  paidAmount: true,
  balanceDue: true,
  currency: true,
  customer: { select: { id: true, name: true, company: true } },
} satisfies Prisma.InvoiceSelect;

export type InvoiceSearchParams = {
  cursor?: string;
  take?: number;
  status?: string;
  q?: string;
  from?: Date;
  to?: Date;
};

export const invoiceRepository = {
  async list(
    organizationId: string,
    params: InvoiceSearchParams = {}
  ): Promise<PaginatedResult<InvoiceListItem>> {
    const take = clampTake(params.take);
    const { cursor, status, q, from, to } = params;

    const where: Prisma.InvoiceWhereInput = {
      organizationId,
      deletedAt: null,
      ...(status && { status: status as Prisma.EnumInvoiceStatusFilter }),
      ...(from || to
        ? { issueDate: { ...(from && { gte: from }), ...(to && { lte: to }) } }
        : {}),
      ...(q && {
        OR: [
          { invoiceNumber: { contains: q, mode: "insensitive" } },
          { customer: { name: { contains: q, mode: "insensitive" } } },
        ],
      }),
    };

    const rows = await prisma.invoice.findMany({
      where,
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: "desc" },
      select: INVOICE_LIST_SELECT,
    });

    return paginate(rows as InvoiceListItem[], take);
  },

  async findById(organizationId: string, id: string) {
    return prisma.invoice.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        items: true,
        payments: true,
      },
    });
  },

  async create(
    organizationId: string,
    data: Prisma.InvoiceCreateInput
  ) {
    return prisma.invoice.create({ data });
  },

  async updateStatus(
    organizationId: string,
    id: string,
    status: string,
    extra: Record<string, unknown> = {}
  ) {
    return prisma.invoice.updateMany({
      where: { id, organizationId },
      data: { status: status as never, ...extra },
    });
  },

  async getStats(organizationId: string) {
    const [total, paid, overdue, draft] = await Promise.all([
      prisma.invoice.aggregate({
        where: { organizationId, deletedAt: null },
        _sum: { total: true },
        _count: true,
      }),
      prisma.invoice.aggregate({
        where: { organizationId, status: "PAID", deletedAt: null },
        _sum: { total: true },
        _count: true,
      }),
      prisma.invoice.count({
        where: { organizationId, status: "OVERDUE", deletedAt: null },
      }),
      prisma.invoice.count({
        where: { organizationId, status: "DRAFT", deletedAt: null },
      }),
    ]);

    return { total, paid, overdue, draft };
  },
};
