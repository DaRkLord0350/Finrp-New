import { prisma } from "@/lib/prisma";
import type { CreateInvoiceInput } from "@/types";

export const invoiceService = {
  async getAll(organizationId: string, status?: string) {
    return prisma.invoice.findMany({
      where: {
        organizationId,
        ...(status ? { status: status as never } : {}),
      },
      include: { customer: true, items: true },
      orderBy: { createdAt: "desc" },
    });
  },

  async getById(id: string, organizationId: string) {
    return prisma.invoice.findFirst({
      where: { id, organizationId },
      include: { customer: true, items: true, payments: true },
    });
  },

  async create(data: CreateInvoiceInput, organizationId: string) {
    const subtotal = data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    const taxRate = data.taxRate ?? 0;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    const count = await prisma.invoice.count({ where: { organizationId } });
    const invoiceNumber = `INV-${String(count + 1).padStart(5, "0")}`;

    return prisma.invoice.create({
      data: {
        invoiceNumber,
        customerId: data.customerId,
        organizationId,
        dueDate: new Date(data.dueDate),
        taxRate,
        taxAmount,
        subtotal,
        total,
        notes: data.notes,
        items: {
          create: data.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.quantity * item.unitPrice,
          })),
        },
      },
      include: { customer: true, items: true },
    });
  },

  async updateStatus(id: string, status: string, organizationId: string) {
    return prisma.invoice.updateMany({
      where: { id, organizationId },
      data: { status: status as never },
    });
  },

  async delete(id: string, organizationId: string) {
    return prisma.invoice.deleteMany({
      where: { id, organizationId },
    });
  },

  async getOverdueInvoices(organizationId: string) {
    const today = new Date();
    return prisma.invoice.findMany({
      where: {
        organizationId,
        status: { in: ["SENT"] },
        dueDate: { lt: today },
      },
      include: { customer: true },
    });
  },
};
