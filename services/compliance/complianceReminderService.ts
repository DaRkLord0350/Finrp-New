import { prisma } from "@/lib/prisma";
import type { CreateComplianceReminderInput } from "@/types/compliance";

export const complianceReminderService = {
  async getAll(organizationId: string) {
    return prisma.complianceReminder.findMany({
      where: { organizationId, isActive: true },
      orderBy: { reminderDate: "asc" },
      include: {
        submission: {
          select: { id: true, title: true, status: true },
        },
      },
    });
  },

  async getUpcoming(organizationId: string, days = 14) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    return prisma.complianceReminder.findMany({
      where: {
        organizationId,
        isActive: true,
        isTriggered: false,
        reminderDate: { gte: new Date(), lte: cutoff },
      },
      orderBy: { reminderDate: "asc" },
      include: {
        submission: {
          select: { id: true, title: true, status: true },
        },
      },
    });
  },

  async getPending(organizationId: string) {
    return prisma.complianceReminder.findMany({
      where: {
        organizationId,
        isActive: true,
        isTriggered: false,
        reminderDate: { lte: new Date() },
      },
      orderBy: { reminderDate: "asc" },
      include: {
        submission: {
          select: { id: true, title: true, status: true },
        },
      },
    });
  },

  async create(data: CreateComplianceReminderInput, organizationId: string) {
    return prisma.complianceReminder.create({
      data: {
        organizationId,
        submissionId: data.submissionId ?? null,
        type: data.type,
        title: data.title,
        message: data.message ?? null,
        reminderDate: new Date(data.reminderDate),
        assignedToId: data.assignedToId ?? null,
      },
    });
  },

  async markTriggered(id: string, organizationId: string) {
    return prisma.complianceReminder.updateMany({
      where: { id, organizationId },
      data: { isTriggered: true, triggeredAt: new Date() },
    });
  },

  async dismiss(id: string, organizationId: string) {
    return prisma.complianceReminder.updateMany({
      where: { id, organizationId },
      data: { isActive: false },
    });
  },

  async delete(id: string, organizationId: string) {
    return prisma.complianceReminder.deleteMany({
      where: { id, organizationId },
    });
  },

  async processDue() {
    const due = await prisma.complianceReminder.findMany({
      where: {
        isActive: true,
        isTriggered: false,
        reminderDate: { lte: new Date() },
      },
      include: {
        submission: { select: { id: true, title: true, organizationId: true } },
      },
    });

    for (const reminder of due) {
      await prisma.$transaction(async (tx) => {
        await tx.complianceReminder.update({
          where: { id: reminder.id },
          data: { isTriggered: true, triggeredAt: new Date() },
        });

        await tx.notification.create({
          data: {
            organizationId: reminder.organizationId,
            type: "COMPLIANCE_REMINDER",
            title: reminder.title,
            message: reminder.message ?? `Compliance reminder: ${reminder.title}`,
            referenceId: reminder.submissionId ?? undefined,
            referenceType: "compliance_submission",
            metadata: {
              reminderId: reminder.id,
              reminderType: reminder.type,
            },
          },
        });
      });
    }

    return due.length;
  },
};
