import { prisma } from "@/lib/prisma";
import type { CreateComplianceTaskInput } from "@/types";

export const complianceService = {
  async getAll(organizationId: string) {
    return prisma.complianceTask.findMany({
      where: { organizationId },
      orderBy: { dueDate: "asc" },
    });
  },

  async getById(id: string, organizationId: string) {
    return prisma.complianceTask.findFirst({
      where: { id, organizationId },
    });
  },

  async create(data: CreateComplianceTaskInput, organizationId: string) {
    return prisma.complianceTask.create({
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        dueDate: new Date(data.dueDate),
        organizationId,
      },
    });
  },

  async updateStatus(id: string, status: string, organizationId: string) {
    return prisma.complianceTask.updateMany({
      where: { id, organizationId },
      data: {
        status: status as never,
        ...(status === "COMPLETED" ? { completedAt: new Date() } : {}),
      },
    });
  },

  async delete(id: string, organizationId: string) {
    return prisma.complianceTask.deleteMany({
      where: { id, organizationId },
    });
  },

  async getUpcoming(organizationId: string, days = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    return prisma.complianceTask.findMany({
      where: {
        organizationId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueDate: { lte: cutoff },
      },
      orderBy: { dueDate: "asc" },
    });
  },
};
