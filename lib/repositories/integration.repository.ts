// ============================================================
// Integration Repository — tenant-scoped connector data access
// ============================================================

import { prisma } from "./base.repository";
import type { ConnectorType, Prisma } from "@prisma/client";

export const integrationRepository = {
  async list(organizationId: string) {
    return (prisma as any).integration.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        oauthToken: { select: { expiresAt: true, scope: true, grantedScopes: true } },
        _count: { select: { syncJobs: true, importJobs: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  },

  async findById(organizationId: string, id: string) {
    return (prisma as any).integration.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
  },

  async findByType(organizationId: string, type: ConnectorType) {
    return (prisma as any).integration.findFirst({
      where: { organizationId, type, deletedAt: null },
    });
  },

  async create(
    organizationId: string,
    data: { type: ConnectorType; name: string; config?: Record<string, unknown>; syncIntervalMins?: number }
  ) {
    return (prisma as any).integration.create({
      data: {
        organizationId,
        type: data.type,
        name: data.name,
        status: "INACTIVE",
        config: (data.config ?? {}) as Prisma.InputJsonValue,
        syncIntervalMins: data.syncIntervalMins ?? 60,
      },
    });
  },

  async update(organizationId: string, id: string, data: Record<string, unknown>) {
    return (prisma as any).integration.updateMany({
      where: { id, organizationId },
      data,
    });
  },

  async softDelete(organizationId: string, id: string) {
    return (prisma as any).integration.updateMany({
      where: { id, organizationId },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });
  },
};
