import { prisma } from "@/lib/prisma";
import type {
  CreateComplianceTypeInput,
  UpdateComplianceTypeInput,
} from "@/types/compliance";

export const complianceTypeService = {
  async getAllByCategory(categoryId: string, organizationId: string) {
    return prisma.complianceType.findMany({
      where: { categoryId, organizationId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { submissions: true } } },
    });
  },

  async getAll(organizationId: string) {
    return prisma.complianceType.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        category: {
          select: { id: true, name: true, code: true, color: true, icon: true },
        },
        _count: { select: { submissions: true } },
      },
    });
  },

  async getById(id: string, organizationId: string) {
    return prisma.complianceType.findFirst({
      where: { id, organizationId },
      include: {
        category: true,
        _count: { select: { submissions: true } },
      },
    });
  },

  async create(
    data: CreateComplianceTypeInput,
    organizationId: string,
    createdBy: string
  ) {
    const category = await prisma.complianceCategory.findFirst({
      where: { id: data.categoryId, organizationId },
    });
    if (!category) throw new Error("Category not found in this organization");

    return prisma.complianceType.create({
      data: {
        organizationId,
        categoryId: data.categoryId,
        name: data.name,
        description: data.description,
        code: data.code.toUpperCase(),
        requiredDocuments: data.requiredDocuments ?? [],
        validityDays: data.validityDays,
        defaultPenalty: data.defaultPenalty,
        sortOrder: data.sortOrder ?? 0,
        createdBy,
      },
    });
  },

  async update(
    id: string,
    data: UpdateComplianceTypeInput,
    organizationId: string,
    updatedBy: string
  ) {
    return prisma.complianceType.updateMany({
      where: { id, organizationId },
      data: { ...data, updatedBy },
    });
  },

  async delete(id: string, organizationId: string) {
    const count = await prisma.complianceSubmission.count({
      where: { typeId: id, organizationId, deletedAt: null },
    });
    if (count > 0) {
      throw new Error(`Cannot delete: ${count} active submission(s) use this type`);
    }
    return prisma.complianceType.delete({ where: { id } });
  },
};
