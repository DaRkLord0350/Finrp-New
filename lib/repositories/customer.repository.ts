// ============================================================
// Customer Repository — tenant-scoped data access
// ALL queries filter by organizationId automatically
// ============================================================

import { prisma, paginate, clampTake, type PaginatedResult } from "./base.repository";
import { Prisma } from "@prisma/client";

export type CustomerListItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  customerType: string;
  totalPurchases: Prisma.Decimal;
  outstandingAmount: Prisma.Decimal;
  creditLimit: Prisma.Decimal;
  isActive: boolean;
  tags: string[];
  createdAt: Date;
  _count: { invoices: number };
};

export type CustomerSearchParams = {
  cursor?: string;
  take?: number;
  q?: string;
  active?: boolean | null;
};

const CUSTOMER_LIST_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  company: true,
  customerType: true,
  totalPurchases: true,
  outstandingAmount: true,
  creditLimit: true,
  isActive: true,
  tags: true,
  createdAt: true,
  _count: { select: { invoices: true } },
} satisfies Prisma.CustomerSelect;

export const customerRepository = {
  async list(
    organizationId: string,
    params: CustomerSearchParams = {}
  ): Promise<PaginatedResult<CustomerListItem>> {
    const take = clampTake(params.take);
    const { cursor, q, active } = params;

    const where: Prisma.CustomerWhereInput = {
      organizationId,
      deletedAt: null,
      ...(active !== null && active !== undefined && { isActive: active }),
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { company: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      }),
    };

    const rows = await prisma.customer.findMany({
      where,
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: "desc" },
      select: CUSTOMER_LIST_SELECT,
    });

    return paginate(rows as CustomerListItem[], take);
  },

  async findById(organizationId: string, id: string) {
    return prisma.customer.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
  },

  async create(
    organizationId: string,
    data: Omit<Prisma.CustomerCreateInput, "organization">
  ) {
    return prisma.customer.create({
      data: { ...data, organization: { connect: { id: organizationId } } },
    });
  },

  async update(
    organizationId: string,
    id: string,
    data: Prisma.CustomerUpdateInput
  ) {
    return prisma.customer.updateMany({
      where: { id, organizationId },
      data,
    });
  },

  async softDelete(organizationId: string, id: string) {
    return prisma.customer.updateMany({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });
  },

  // Lightweight list for dropdowns — no pagination needed
  async listForSelect(organizationId: string) {
    return prisma.customer.findMany({
      where: { organizationId, isActive: true, deletedAt: null },
      select: { id: true, name: true, company: true, email: true, phone: true },
      orderBy: { name: "asc" },
      take: 500,
    });
  },

  async topByRevenue(organizationId: string, take = 10) {
    const customers = await prisma.customer.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        _count: { select: { invoices: true } },
        invoices: { select: { total: true, status: true, balanceDue: true } },
      },
      orderBy: { totalPurchases: "desc" },
      take,
    });
    return customers.map((c) => {
      const paid = c.invoices.filter((i) => i.status === "PAID");
      const outstanding = c.invoices.filter((i) => i.status === "PARTIAL" || i.status === "OVERDUE");
      return {
        id: c.id,
        name: c.name,
        company: c.company,
        customerType: c.customerType,
        totalRevenue: paid.reduce((s, i) => s + Number(i.total), 0),
        outstandingRevenue: outstanding.reduce((s, i) => s + Number(i.total), 0),
        invoiceCount: c._count.invoices,
      };
    });
  },

  async overdueByCustomer(organizationId: string, take = 10) {
    const now = new Date();
    const invoices = await prisma.invoice.findMany({
      where: { organizationId, dueDate: { lt: now }, status: { in: ["OVERDUE", "PARTIAL"] } },
      include: { customer: { select: { id: true, name: true, company: true } } },
      orderBy: { dueDate: "asc" },
    });
    const byCustomer = new Map<string, typeof invoices>();
    for (const inv of invoices) {
      if (!byCustomer.has(inv.customerId)) byCustomer.set(inv.customerId, []);
      byCustomer.get(inv.customerId)!.push(inv);
    }
    return Array.from(byCustomer.values())
      .map((invs) => {
        const oldest = invs.reduce((o, i) => (i.dueDate < o ? i.dueDate : o), invs[0].dueDate);
        return {
          id: invs[0].customer.id,
          name: invs[0].customer.name,
          company: invs[0].customer.company,
          totalOverdue: invs.reduce((s, i) => s + Number(i.balanceDue), 0),
          overdueInvoiceCount: invs.length,
          dayOverdue: Math.floor((now.getTime() - oldest.getTime()) / 86_400_000),
        };
      })
      .sort((a, b) => b.totalOverdue - a.totalOverdue)
      .slice(0, take);
  },
};
