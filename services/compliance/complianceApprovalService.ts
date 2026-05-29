import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { ApproveComplianceInput } from "@/types/compliance";

const STATUS_MAP = {
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
  REQUEST_CHANGES: "UNDER_REVIEW",
  ESCALATE: "UNDER_REVIEW",
} as const;

export const complianceApprovalService = {
  async approve(
    submissionId: string,
    input: ApproveComplianceInput,
    organizationId: string,
    approvedById: string
  ) {
    return prisma.$transaction(async (tx) => {
      const submission = await tx.complianceSubmission.findFirst({
        where: { id: submissionId, organizationId, deletedAt: null },
      });
      if (!submission) throw new Error("Submission not found");

      const allowedActions: Record<string, string[]> = {
        SUBMITTED: ["APPROVE", "REJECT", "REQUEST_CHANGES", "ESCALATE"],
        UNDER_REVIEW: ["APPROVE", "REJECT", "REQUEST_CHANGES", "ESCALATE"],
      };
      const allowed = allowedActions[submission.status] ?? [];
      if (!allowed.includes(input.action)) {
        throw new Error(
          `Action "${input.action}" is not allowed when status is "${submission.status}"`
        );
      }

      const newStatus = STATUS_MAP[input.action];

      const [approval] = await Promise.all([
        tx.complianceApproval.create({
          data: {
            organizationId,
            submissionId,
            action: input.action,
            comments: input.comments ?? null,
            conditions: input.conditions ?? null,
            approvedById,
            approvedAt: new Date(),
          },
        }),
        tx.complianceSubmission.update({
          where: { id: submissionId },
          data: {
            status: newStatus,
            reviewedById: approvedById,
            updatedBy: approvedById,
          },
        }),
        tx.complianceStatusHistory.create({
          data: {
            organizationId,
            submissionId,
            fromStatus: submission.status,
            toStatus: newStatus,
            reason: input.comments ?? null,
            changedById: approvedById,
          },
        }),
        tx.complianceAuditLog.create({
          data: {
            organizationId,
            submissionId,
            action: input.action,
            description: `${input.action}: ${input.comments ?? "No comments"}`,
            performedById: approvedById,
            oldValue: { status: submission.status } as Prisma.InputJsonValue,
            newValue: { status: newStatus, action: input.action } as Prisma.InputJsonValue,
          },
        }),
      ]);

      return approval;
    });
  },

  async getBySubmission(submissionId: string, organizationId: string) {
    return prisma.complianceApproval.findMany({
      where: { submissionId, organizationId },
      orderBy: { createdAt: "desc" },
    });
  },
};
