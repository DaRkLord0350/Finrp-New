import { prisma } from "@/lib/prisma";
import type {
  CreateComplianceCategoryInput,
  UpdateComplianceCategoryInput,
} from "@/types/compliance";

export const complianceCategoryService = {
  async getAll(organizationId: string) {
    return prisma.complianceCategory.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { submissions: true, types: true } },
      },
    });
  },

  async getAllIncludingInactive(organizationId: string) {
    return prisma.complianceCategory.findMany({
      where: { organizationId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { submissions: true, types: true } },
      },
    });
  },

  async getById(id: string, organizationId: string) {
    return prisma.complianceCategory.findFirst({
      where: { id, organizationId },
      include: {
        types: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: { _count: { select: { submissions: true } } },
        },
        _count: { select: { submissions: true } },
      },
    });
  },

  async create(
    data: CreateComplianceCategoryInput,
    organizationId: string,
    createdBy: string
  ) {
    return prisma.complianceCategory.create({
      data: {
        organizationId,
        name: data.name,
        description: data.description,
        code: data.code.toUpperCase(),
        color: data.color ?? "#6366f1",
        icon: data.icon ?? "ShieldCheck",
        sortOrder: data.sortOrder ?? 0,
        createdBy,
      },
    });
  },

  async update(
    id: string,
    data: UpdateComplianceCategoryInput,
    organizationId: string,
    updatedBy: string
  ) {
    return prisma.complianceCategory.updateMany({
      where: { id, organizationId },
      data: { ...data, updatedBy },
    });
  },

  async delete(id: string, organizationId: string) {
    const count = await prisma.complianceSubmission.count({
      where: { categoryId: id, organizationId, deletedAt: null },
    });
    if (count > 0) {
      throw new Error(
        `Cannot delete: ${count} active submission(s) exist in this category`
      );
    }
    return prisma.complianceCategory.delete({ where: { id } });
  },

  async seedDefaults(organizationId: string, createdBy: string) {
    const defaults = [
      { name: "Tax Compliance", code: "TAX", color: "#6366f1", icon: "Receipt", sortOrder: 0 },
      { name: "GST Compliance", code: "GST", color: "#8b5cf6", icon: "FileText", sortOrder: 1 },
      { name: "TDS / TCS", code: "TDS", color: "#3b82f6", icon: "Calculator", sortOrder: 2 },
      { name: "Regulatory", code: "REGULATORY", color: "#f59e0b", icon: "Scale", sortOrder: 3 },
      { name: "Operational License", code: "LICENSE", color: "#10b981", icon: "BadgeCheck", sortOrder: 4 },
      { name: "Financial Compliance", code: "FINANCIAL", color: "#06b6d4", icon: "TrendingUp", sortOrder: 5 },
      { name: "Audit", code: "AUDIT", color: "#ef4444", icon: "Search", sortOrder: 6 },
      { name: "Employee & Payroll", code: "PAYROLL", color: "#f97316", icon: "Users", sortOrder: 7 },
      { name: "Vendor Compliance", code: "VENDOR", color: "#84cc16", icon: "Truck", sortOrder: 8 },
      { name: "Legal & Contract", code: "LEGAL", color: "#a855f7", icon: "BookOpen", sortOrder: 9 },
      { name: "Custom", code: "CUSTOM", color: "#52525b", icon: "Settings", sortOrder: 10 },
    ];

    return prisma.$transaction(
      defaults.map((cat) =>
        prisma.complianceCategory.upsert({
          where: { organizationId_code: { organizationId, code: cat.code } },
          update: {},
          create: { organizationId, ...cat, isSystem: true, createdBy },
        })
      )
    );
  },
};
