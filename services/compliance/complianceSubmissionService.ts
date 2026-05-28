import { prisma } from "@/lib/prisma";
import { type ComplianceStatus, Prisma } from "@prisma/client";
import type {
  CreateComplianceSubmissionInput,
  UpdateComplianceSubmissionInput,
  SubmissionsQueryParams,
} from "@/types/compliance";

const SUBMISSION_LIST_SELECT = {
  id: true,
  organizationId: true,
  categoryId: true,
  typeId: true,
  title: true,
  description: true,
  referenceNumber: true,
  status: true,
  submissionDate: true,
  effectiveDate: true,
  expiryDate: true,
  dueDate: true,
  renewalDate: true,
  penaltyAmount: true,
  feeAmount: true,
  assignedToId: true,
  reviewedById: true,
  version: true,
  tags: true,
  notes: true,
  createdBy: true,
  updatedBy: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: { id: true, name: true, code: true, color: true, icon: true },
  },
  type: {
    select: { id: true, name: true, code: true },
  },
  _count: { select: { documents: true, approvals: true } },
} as const;

export const complianceSubmissionService = {
  async getAll(organizationId: string, params: SubmissionsQueryParams = {}) {
    const {
      status,
      categoryId,
      typeId,
      search,
      page = 1,
      pageSize = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
      includeDeleted = false,
    } = params;

    const where: Prisma.ComplianceSubmissionWhereInput = {
      organizationId,
      deletedAt: includeDeleted ? undefined : null,
      ...(status && { status }),
      ...(categoryId && { categoryId }),
      ...(typeId && { typeId }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { referenceNumber: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [data, total] = await prisma.$transaction([
      prisma.complianceSubmission.findMany({
        where,
        select: SUBMISSION_LIST_SELECT,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.complianceSubmission.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  async getById(id: string, organizationId: string) {
    return prisma.complianceSubmission.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        category: true,
        type: true,
        documents: {
          where: { isLatest: true },
          select: {
            id: true,
            fileName: true,
            fileExtension: true,
            mimeType: true,
            fileSize: true,
            checksum: true,
            version: true,
            isLatest: true,
            documentType: true,
            description: true,
            uploadedById: true,
            uploadedAt: true,
            createdAt: true,
            submissionId: true,
            organizationId: true,
          },
          orderBy: { uploadedAt: "desc" },
        },
        approvals: { orderBy: { createdAt: "desc" } },
        statusHistory: { orderBy: { changedAt: "desc" } },
        deadlines: { orderBy: { deadlineDate: "asc" } },
        reminders: {
          where: { isActive: true },
          orderBy: { reminderDate: "asc" },
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });
  },

  async create(
    data: CreateComplianceSubmissionInput,
    organizationId: string,
    createdBy: string
  ) {
    return prisma.$transaction(async (tx) => {
      const submission = await tx.complianceSubmission.create({
        data: {
          organizationId,
          categoryId: data.categoryId,
          typeId: data.typeId ?? null,
          title: data.title,
          description: data.description ?? null,
          referenceNumber: data.referenceNumber ?? null,
          status: data.status ?? "DRAFT",
          submissionDate: data.submissionDate ? new Date(data.submissionDate) : null,
          effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          renewalDate: data.renewalDate ? new Date(data.renewalDate) : null,
          penaltyAmount: data.penaltyAmount ?? null,
          feeAmount: data.feeAmount ?? null,
          assignedToId: data.assignedToId ?? null,
          complianceData: data.complianceData
            ? (data.complianceData as Prisma.InputJsonValue)
            : Prisma.DbNull,
          tags: data.tags ?? [],
          notes: data.notes ?? null,
          createdBy,
        },
      });

      await tx.complianceStatusHistory.create({
        data: {
          organizationId,
          submissionId: submission.id,
          fromStatus: null,
          toStatus: submission.status,
          reason: "Initial creation",
          changedById: createdBy,
        },
      });

      await tx.complianceAuditLog.create({
        data: {
          organizationId,
          submissionId: submission.id,
          action: "CREATED",
          description: `Compliance submission "${submission.title}" created`,
          performedById: createdBy,
          newValue: { status: submission.status, title: submission.title } as Prisma.InputJsonValue,
        },
      });

      if (data.dueDate) {
        const dueDate = new Date(data.dueDate);
        const reminderDate = new Date(dueDate);
        reminderDate.setDate(reminderDate.getDate() - 7);
        if (reminderDate > new Date()) {
          await tx.complianceReminder.create({
            data: {
              organizationId,
              submissionId: submission.id,
              type: "DUE_DATE",
              title: `Due date approaching: ${data.title}`,
              message: `"${data.title}" is due in 7 days`,
              reminderDate,
              assignedToId: data.assignedToId ?? null,
            },
          });
        }
      }

      if (data.expiryDate) {
        const expiryDate = new Date(data.expiryDate);
        const reminderDate = new Date(expiryDate);
        reminderDate.setDate(reminderDate.getDate() - 30);
        if (reminderDate > new Date()) {
          await tx.complianceReminder.create({
            data: {
              organizationId,
              submissionId: submission.id,
              type: "EXPIRY",
              title: `Expiry approaching: ${data.title}`,
              message: `"${data.title}" expires in 30 days`,
              reminderDate,
              assignedToId: data.assignedToId ?? null,
            },
          });
        }
      }

      return submission;
    });
  },

  async update(
    id: string,
    data: UpdateComplianceSubmissionInput,
    organizationId: string,
    updatedBy: string
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.complianceSubmission.findFirst({
        where: { id, organizationId, deletedAt: null },
      });
      if (!existing) throw new Error("Submission not found");

      const { status, submissionDate, effectiveDate, expiryDate, dueDate, renewalDate, complianceData, ...rest } = data;

      const updated = await tx.complianceSubmission.update({
        where: { id },
        data: {
          ...rest,
          ...(status !== undefined && { status }),
          ...(submissionDate !== undefined && {
            submissionDate: submissionDate ? new Date(submissionDate) : null,
          }),
          ...(effectiveDate !== undefined && {
            effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
          }),
          ...(expiryDate !== undefined && {
            expiryDate: expiryDate ? new Date(expiryDate) : null,
          }),
          ...(dueDate !== undefined && {
            dueDate: dueDate ? new Date(dueDate) : null,
          }),
          ...(renewalDate !== undefined && {
            renewalDate: renewalDate ? new Date(renewalDate) : null,
          }),
          ...(complianceData !== undefined && {
            complianceData: complianceData
              ? (complianceData as Prisma.InputJsonValue)
              : Prisma.DbNull,
          }),
          updatedBy,
          version: { increment: 1 },
        },
      });

      if (status && status !== existing.status) {
        await tx.complianceStatusHistory.create({
          data: {
            organizationId,
            submissionId: id,
            fromStatus: existing.status,
            toStatus: status,
            changedById: updatedBy,
          },
        });
      }

      await tx.complianceAuditLog.create({
        data: {
          organizationId,
          submissionId: id,
          action: "UPDATED",
          description: "Compliance submission updated",
          performedById: updatedBy,
          oldValue: { status: existing.status, title: existing.title } as Prisma.InputJsonValue,
          newValue: { status: updated.status, title: updated.title } as Prisma.InputJsonValue,
        },
      });

      return updated;
    });
  },

  async softDelete(id: string, organizationId: string, deletedBy: string) {
    return prisma.$transaction(async (tx) => {
      const result = await tx.complianceSubmission.updateMany({
        where: { id, organizationId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: deletedBy },
      });
      if (result.count === 0) throw new Error("Submission not found");

      await tx.complianceAuditLog.create({
        data: {
          organizationId,
          submissionId: id,
          action: "DELETED",
          description: "Compliance submission archived",
          performedById: deletedBy,
        },
      });
    });
  },

  async changeStatus(
    id: string,
    status: ComplianceStatus,
    organizationId: string,
    changedBy: string,
    reason?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.complianceSubmission.findFirst({
        where: { id, organizationId, deletedAt: null },
      });
      if (!existing) throw new Error("Submission not found");

      const updated = await tx.complianceSubmission.update({
        where: { id },
        data: { status, updatedBy: changedBy },
      });

      await tx.complianceStatusHistory.create({
        data: {
          organizationId,
          submissionId: id,
          fromStatus: existing.status,
          toStatus: status,
          reason: reason ?? null,
          changedById: changedBy,
        },
      });

      await tx.complianceAuditLog.create({
        data: {
          organizationId,
          submissionId: id,
          action: "STATUS_CHANGED",
          description: `Status changed from ${existing.status} to ${status}`,
          performedById: changedBy,
          oldValue: { status: existing.status } as Prisma.InputJsonValue,
          newValue: { status } as Prisma.InputJsonValue,
        },
      });

      return updated;
    });
  },

  async getExpiringSoon(organizationId: string, days = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    return prisma.complianceSubmission.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: ["APPROVED", "SUBMITTED"] },
        expiryDate: { gte: new Date(), lte: cutoff },
      },
      select: SUBMISSION_LIST_SELECT,
      orderBy: { expiryDate: "asc" },
    });
  },

  async getOverdue(organizationId: string) {
    return prisma.complianceSubmission.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: ["DRAFT", "SUBMITTED", "UNDER_REVIEW"] },
        dueDate: { lt: new Date() },
      },
      select: SUBMISSION_LIST_SELECT,
      orderBy: { dueDate: "asc" },
    });
  },
};
