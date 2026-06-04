// ============================================================
// User Repository — tenant-scoped user data access
// ============================================================

import { prisma } from "./base.repository";
import { auth } from "@clerk/nextjs/server";

export const userRepository = {
  async getByClerkId(clerkId: string) {
    return prisma.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        designation: true,
        department: true,
        avatarUrl: true,
        role: true,
        lastLoginAt: true,
        notificationPreference: true,
        createdAt: true,
        organizationId: true,
      },
    });
  },

  async getCurrentUser() {
    const { userId } = await auth();
    if (!userId) return null;
    return userRepository.getByClerkId(userId);
  },

  async listByOrg(organizationId: string) {
    return prisma.user.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        designation: true,
        avatarUrl: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });
  },

  async updateProfile(
    clerkId: string,
    data: { name?: string; phone?: string; designation?: string; department?: string; avatarUrl?: string }
  ) {
    return prisma.user.update({
      where: { clerkId },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.phone !== undefined && { phone: data.phone?.trim() || null }),
        ...(data.designation !== undefined && { designation: data.designation?.trim() || null }),
        ...(data.department !== undefined && { department: data.department?.trim() || null }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
      },
      select: {
        id: true, name: true, email: true, phone: true,
        designation: true, department: true, avatarUrl: true,
        role: true, lastLoginAt: true, createdAt: true,
      },
    });
  },
};
