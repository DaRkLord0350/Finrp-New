// ============================================================
// Notification Repository — tenant-scoped notification data access
// ============================================================

import { prisma } from "./base.repository";

export const notificationRepository = {
  async list(organizationId: string, userId: string, limit = 20) {
    return prisma.notification.findMany({
      where: { organizationId, userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  async unreadCount(organizationId: string, userId: string) {
    return prisma.notification.count({ where: { organizationId, userId, isRead: false } });
  },

  async markAllRead(organizationId: string, userId: string) {
    return prisma.notification.updateMany({
      where: { organizationId, userId, isRead: false },
      data: { isRead: true },
    });
  },

  async markRead(organizationId: string, id: string) {
    return prisma.notification.updateMany({
      where: { id, organizationId },
      data: { isRead: true },
    });
  },

  async getSettings(organizationId: string, userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: { notificationPreference: true },
    });
    return user?.notificationPreference ?? null;
  },

  async updateSettings(organizationId: string, userId: string, prefs: Record<string, unknown>) {
    return prisma.user.updateMany({
      where: { id: userId, organizationId },
      data: { notificationPreference: prefs as Parameters<typeof prisma.user.updateMany>[0]["data"]["notificationPreference"] },
    });
  },
};
