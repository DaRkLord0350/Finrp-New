// ============================================================
// lib/services/bank-verification.service.ts
// Module 6 — Bank Account Linking. Orchestrates a TBX penny-drop /
// penniless BAV call against an EXISTING BankAccount row (never
// creates or duplicates BankAccount — that model already exists,
// owned by Banking OS) and records the result as a satellite
// OrgBankAccountVerification row.
// ============================================================

import { prisma } from "@/lib/repositories/base.repository";
import { bankVerificationRepository } from "@/lib/repositories/bank-verification.repository";
import { createAuditLog } from "@/lib/audit";
import { kycStatusService } from "@/lib/services/kyc-status.service";
import { BankVerificationError } from "@/lib/bank-verification/http";
import * as tbxService from "@/lib/tbx/service";
import type { BankVerificationMethod } from "@prisma/client";

type Actor = { userId: string | null };

export const bankVerificationService = {
  async listForAccount(organizationId: string, bankAccountId: string) {
    return bankVerificationRepository.listForAccount(organizationId, bankAccountId);
  },

  async verify(organizationId: string, actor: Actor, bankAccountId: string, method: BankVerificationMethod) {
    const account = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, organizationId, deletedAt: null },
    });
    if (!account) throw new BankVerificationError("Bank account not found", 404);
    if (!account.ifscCode) throw new BankVerificationError("Bank account has no IFSC code on file", 400);

    const result = await tbxService.verifyBankAccount(
      { accountNumber: account.accountNumber, ifsc: account.ifscCode, method, nameToMatch: account.accountName },
      { organizationId, userId: actor.userId, subjectType: "bank_account", subjectId: bankAccountId }
    );

    const record = await bankVerificationRepository.create(organizationId, bankAccountId, {
      verificationMethod: method,
      verificationStatus: result.outcome,
      verifiedAccountHolderName: result.verifiedAccountHolderName,
      nameMatchScore: result.nameMatchScore,
      tbxReferenceId: result.referenceId,
      failureReason: result.outcome === "FAILED" ? "Name/account mismatch or TBX rejection" : undefined,
    });

    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "UPDATE",
      entity: "bank_account",
      entityId: bankAccountId,
      description: `TBX ${method} verification for "${account.accountName}": ${result.outcome}`,
    });

    if (account.isPrimary) {
      const primaryVerified = await bankVerificationRepository.isPrimaryAccountVerified(organizationId);
      await kycStatusService.markPrimaryBankVerified(organizationId, primaryVerified);
    }

    return record;
  },
};
