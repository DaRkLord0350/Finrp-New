// ============================================================
// lib/services/admin-kyc.service.ts
// Module 9 — Admin Dashboard. Read-side queues over Modules 1/3/
// 4/5/6/7/8's data, plus the admin approve/reject decision action.
// Platform-wide (not tenant-scoped) — callers must be ADMIN, gated
// the same way every other app/(admin) page/route already is (flat
// userRole === "ADMIN" check, not the AppModule RBAC system).
// ============================================================

import { prisma } from "@/lib/prisma";
import { kycProfileRepository } from "@/lib/repositories/kyc-profile.repository";
import { kycStatusService } from "@/lib/services/kyc-status.service";
import type { KycStatus } from "@prisma/client";

type Actor = { userId: string | null };

export const adminKycService = {
  async listKycQueue(status?: KycStatus, page = 1, pageSize = 25) {
    return kycProfileRepository.listByStatus(status, page, pageSize);
  },

  async kycCounts() {
    return kycProfileRepository.countByStatus();
  },

  async approve(organizationId: string, actor: Actor) {
    return kycStatusService.approve(organizationId, actor);
  },

  async reject(organizationId: string, actor: Actor, reason: string) {
    return kycStatusService.reject(organizationId, actor, reason);
  },

  /** Org documents pending manual review. */
  async listDocumentQueue(page = 1, pageSize = 25) {
    const where = { status: "PENDING_VERIFICATION" as const, deletedAt: null };
    const [data, total] = await Promise.all([
      prisma.organizationDocument.findMany({
        where,
        orderBy: { uploadedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { organization: { select: { id: true, name: true } } },
      }),
      prisma.organizationDocument.count({ where }),
    ]);
    return { data, total, page, pageSize };
  },

  /** Bank account verifications, most recent first. */
  async listBankVerificationQueue(page = 1, pageSize = 25) {
    const [data, total] = await Promise.all([
      prisma.orgBankAccountVerification.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          organization: { select: { id: true, name: true } },
          bankAccount: { select: { accountName: true, bankName: true, maskedNumber: true } },
        },
      }),
      prisma.orgBankAccountVerification.count(),
    ]);
    return { data, total, page, pageSize };
  },
};
