// ============================================================
// lib/repositories/kyc-profile.repository.ts
// Tenant-scoped reads/writes for KycProfile (Module 7 — the
// denormalized current-status snapshot, one row per organization).
// ============================================================

import { prisma } from "./base.repository";
import type { KycStatus, Prisma } from "@prisma/client";

export const kycProfileRepository = {
  async findByOrg(organizationId: string) {
    return prisma.kycProfile.findUnique({ where: { organizationId } });
  },

  async ensure(organizationId: string) {
    return prisma.kycProfile.upsert({
      where: { organizationId },
      create: { organizationId },
      update: {},
    });
  },

  async update(organizationId: string, data: Prisma.KycProfileUncheckedUpdateInput) {
    return prisma.kycProfile.upsert({
      where: { organizationId },
      create: Object.assign({ organizationId }, data) as Prisma.KycProfileUncheckedCreateInput,
      update: data,
    });
  },

  /** Admin queue (Module 9) — orgs by status, newest submission first. */
  async listByStatus(status?: KycStatus, page = 1, pageSize = 25) {
    const where = status ? { status } : {};
    const [data, total] = await Promise.all([
      prisma.kycProfile.findMany({
        where,
        orderBy: { submittedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { organization: { select: { id: true, name: true, slug: true } } },
      }),
      prisma.kycProfile.count({ where }),
    ]);
    return { data, total, page, pageSize };
  },

  async countByStatus() {
    const rows = await prisma.kycProfile.groupBy({ by: ["status"], _count: { _all: true } });
    const out: Record<string, number> = {};
    for (const r of rows) out[r.status] = r._count._all;
    return out;
  },
};
