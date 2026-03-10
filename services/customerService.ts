import { prisma } from "@/lib/prisma";
import type { CreateCustomerInput } from "@/types";

export const customerService = {
  async getAll(organizationId: string) {
    return prisma.customer.findMany({
      where: { organizationId },
      include: { _count: { select: { invoices: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  async getById(id: string, organizationId: string) {
    return prisma.customer.findFirst({
      where: { id, organizationId },
      include: {
        invoices: {
          orderBy: { createdAt: "desc" },
          include: { items: true },
        },
      },
    });
  },

  async create(data: CreateCustomerInput, organizationId: string) {
    return prisma.customer.create({
      data: { ...data, organizationId },
    });
  },

  async update(id: string, data: Partial<CreateCustomerInput>, organizationId: string) {
    return prisma.customer.updateMany({
      where: { id, organizationId },
      data,
    });
  },

  async delete(id: string, organizationId: string) {
    return prisma.customer.deleteMany({
      where: { id, organizationId },
    });
  },

  async getTotalRevenue(id: string, organizationId: string): Promise<number> {
    const invoices = await prisma.invoice.findMany({
      where: { customerId: id, organizationId, status: "PAID" },
      select: { total: true },
    });
    return invoices.reduce((sum: number, inv: { total: { toString(): string } }) => sum + Number(inv.total), 0);
  },
};
