// ============================================================
// lib/repositories/bank-verification.repository.ts
// Tenant-scoped reads/writes for OrgBankAccountVerification
// (Module 6 — satellite off the existing BankAccount).
// ============================================================

import { prisma } from "./base.repository";
import type { BankVerificationMethod, Prisma, TbxVerificationStatus } from "@prisma/client";

export const bankVerificationRepository = {
  async listForAccount(organizationId: string, bankAccountId: string) {
    return prisma.orgBankAccountVerification.findMany({
      where: { organizationId, bankAccountId },
      orderBy: { createdAt: "desc" },
    });
  },

  async latestForAccount(organizationId: string, bankAccountId: string) {
    return prisma.orgBankAccountVerification.findFirst({
      where: { organizationId, bankAccountId },
      orderBy: { createdAt: "desc" },
    });
  },

  async create(
    organizationId: string,
    bankAccountId: string,
    data: {
      verificationMethod: BankVerificationMethod;
      verificationStatus: TbxVerificationStatus;
      verifiedAccountHolderName?: string;
      nameMatchScore?: number;
      tbxReferenceId?: string;
      failureReason?: string;
    }
  ) {
    return prisma.orgBankAccountVerification.create({
      data: {
        organizationId,
        bankAccountId,
        ...data,
        verifiedAt: data.verificationStatus === "VERIFIED" ? new Date() : null,
      } as Prisma.OrgBankAccountVerificationUncheckedCreateInput,
    });
  },

  /** True if this org has at least one VERIFIED verification on its primary bank account. */
  async isPrimaryAccountVerified(organizationId: string): Promise<boolean> {
    const primary = await prisma.bankAccount.findFirst({
      where: { organizationId, isPrimary: true, deletedAt: null },
      select: { id: true },
    });
    if (!primary) return false;

    const verified = await prisma.orgBankAccountVerification.findFirst({
      where: { organizationId, bankAccountId: primary.id, verificationStatus: "VERIFIED" },
    });
    return Boolean(verified);
  },
};
