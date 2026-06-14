// ============================================================
// Compliance Repository — tenant-scoped data access
// ============================================================

import { prisma, paginate, clampTake, type PaginatedResult } from "./base.repository";
import { Prisma, ComplianceStatus } from "@prisma/client";

export type SubmissionListItem = {
  id: string;
  title: string;
  status: ComplianceStatus;
  dueDate: Date | null;
  expiryDate: Date | null;
  category: { id: string; name: string; color: string; icon: string };
};

const SUBMISSION_LIST_SELECT = {
  id: true,
  title: true,
  status: true,
  dueDate: true,
  expiryDate: true,
  category: { select: { id: true, name: true, color: true, icon: true } },
} satisfies Prisma.ComplianceSubmissionSelect;

export type SubmissionSearchParams = {
  cursor?: string;
  take?: number;
  status?: ComplianceStatus;
  categoryId?: string;
};

export const complianceRepository = {
  async listSubmissions(
    organizationId: string,
    params: SubmissionSearchParams = {}
  ): Promise<PaginatedResult<SubmissionListItem>> {
    const take = clampTake(params.take);
    const { cursor, status, categoryId } = params;

    const where: Prisma.ComplianceSubmissionWhereInput = {
      organizationId,
      deletedAt: null,
      ...(status && { status }),
      ...(categoryId && { categoryId }),
    };

    const rows = await prisma.complianceSubmission.findMany({
      where,
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: "desc" },
      select: SUBMISSION_LIST_SELECT,
    });

    return paginate(rows as SubmissionListItem[], take);
  },

  async listCategories(organizationId: string) {
    return prisma.complianceCategory.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        types: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { submissions: true } },
      },
    });
  },

  async getSubmission(organizationId: string, id: string) {
    return prisma.complianceSubmission.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        category: true,
        type: true,
        documents: {
          select: {
            id: true, fileName: true, fileSize: true,
            reviewStatus: true, uploadedAt: true, version: true, isLatest: true,
          },
        },
        approvals: { orderBy: { approvedAt: "desc" } },
        reminders: { where: { isActive: true }, orderBy: { reminderDate: "asc" } },
        statusHistory: { orderBy: { changedAt: "desc" }, take: 20 },
        auditLogs: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
  },

  async getDashboardStats(organizationId: string) {
    const now = new Date();
    const in30 = new Date(now);
    in30.setDate(now.getDate() + 30);

    const [total, submitted, approved, expiringSoon, overdue] =
      await Promise.all([
        prisma.complianceSubmission.count({ where: { organizationId, deletedAt: null } }),
        prisma.complianceSubmission.count({ where: { organizationId, deletedAt: null, status: "SUBMITTED" } }),
        prisma.complianceSubmission.count({ where: { organizationId, deletedAt: null, status: "APPROVED" } }),
        prisma.complianceSubmission.count({
          where: {
            organizationId, deletedAt: null,
            expiryDate: { gte: now, lte: in30 },
            status: { notIn: ["EXPIRED"] },
          },
        }),
        prisma.complianceSubmission.count({
          where: {
            organizationId, deletedAt: null,
            dueDate: { lt: now },
            status: { notIn: ["COMPLETED", "APPROVED"] },
          },
        }),
      ]);

    return { total, submitted, approved, expiringSoon, overdue };
  },
};
