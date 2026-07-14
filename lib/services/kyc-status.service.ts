// ============================================================
// lib/services/kyc-status.service.ts
//
// Module 7 — Master KYC Status Engine. The single place that
// computes KycProfile.status from its sub-verification flags. Every
// other module (Org Master, Related Parties, Bank Verification,
// Document Vault, the Onboarding Wizard) reports facts in here via
// markX() calls — none of them set `status` directly.
//
// State machine (auto-advanced, "happy path" only):
//   DRAFT --(TBX customer created)--> SUBMITTED
//   SUBMITTED --(some sub-flags true)--> VERIFICATION_PENDING
//   VERIFICATION_PENDING --(all sub-flags true)--> KYC_PENDING
//   KYC_PENDING --(admin decision)--> APPROVED | REJECTED
// APPROVED / REJECTED / SUSPENDED / EXPIRED are terminal/admin-set —
// recomputeStatus() never overwrites them; only approve()/reject()/
// suspend() (explicit admin actions, Module 9) or resubmit() do.
// ============================================================

import { kycProfileRepository } from "@/lib/repositories/kyc-profile.repository";
import { createAuditLog } from "@/lib/audit";
import type { KycStatus } from "@prisma/client";

type Actor = { userId: string | null };

const TERMINAL_STATUSES: KycStatus[] = ["APPROVED", "REJECTED", "SUSPENDED", "EXPIRED"];

function computeStatus(flags: {
  tbxCustomerCreated: boolean;
  orgIdentityVerified: boolean;
  primaryBankVerified: boolean;
  signatoryVerified: boolean;
  documentsComplete: boolean;
}): KycStatus {
  if (!flags.tbxCustomerCreated) return "DRAFT";

  const allVerified =
    flags.orgIdentityVerified && flags.primaryBankVerified && flags.signatoryVerified && flags.documentsComplete;
  if (allVerified) return "KYC_PENDING"; // auto-verification complete, awaiting admin approval

  const anyVerified =
    flags.orgIdentityVerified || flags.primaryBankVerified || flags.signatoryVerified || flags.documentsComplete;
  return anyVerified ? "VERIFICATION_PENDING" : "SUBMITTED";
}

export const kycStatusService = {
  async getProfile(organizationId: string) {
    return kycProfileRepository.ensure(organizationId);
  },

  /** Recompute `status` from the current sub-flags. No-op on terminal statuses. */
  async recompute(organizationId: string) {
    const profile = await kycProfileRepository.ensure(organizationId);
    if (TERMINAL_STATUSES.includes(profile.status)) return profile;

    const status = computeStatus(profile);
    return kycProfileRepository.update(organizationId, { status, lastEvaluatedAt: new Date() });
  },

  async markOrgIdentityVerified(organizationId: string, verified: boolean) {
    await kycProfileRepository.update(organizationId, { orgIdentityVerified: verified });
    return kycStatusService.recompute(organizationId);
  },

  async markPrimaryBankVerified(organizationId: string, verified: boolean) {
    await kycProfileRepository.update(organizationId, { primaryBankVerified: verified });
    return kycStatusService.recompute(organizationId);
  },

  async markSignatoryVerified(organizationId: string, verified: boolean) {
    await kycProfileRepository.update(organizationId, { signatoryVerified: verified });
    return kycStatusService.recompute(organizationId);
  },

  async markDocumentsComplete(organizationId: string, complete: boolean) {
    await kycProfileRepository.update(organizationId, { documentsComplete: complete });
    return kycStatusService.recompute(organizationId);
  },

  /** Wizard Submit step — TBX customer created, moves DRAFT -> SUBMITTED. */
  async markSubmitted(organizationId: string, tbxCustomerCreated = true) {
    await kycProfileRepository.update(organizationId, {
      tbxCustomerCreated,
      submittedAt: new Date(),
    });
    return kycStatusService.recompute(organizationId);
  },

  /** Admin approval (Module 9) — terminal, not auto-derived. */
  async approve(organizationId: string, actor: Actor) {
    const updated = await kycProfileRepository.update(organizationId, {
      status: "APPROVED",
      approvedAt: new Date(),
      rejectionReason: null,
      lastEvaluatedAt: new Date(),
    });
    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "UPDATE",
      entity: "kyc_profile",
      entityId: organizationId,
      description: "KYC approved",
    });
    return updated;
  },

  /** Admin rejection (Module 9) — terminal, not auto-derived. */
  async reject(organizationId: string, actor: Actor, reason: string) {
    const updated = await kycProfileRepository.update(organizationId, {
      status: "REJECTED",
      rejectionReason: reason,
      lastEvaluatedAt: new Date(),
    });
    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "UPDATE",
      entity: "kyc_profile",
      entityId: organizationId,
      description: `KYC rejected: ${reason}`,
    });
    return updated;
  },

  /** Admin suspension of a previously-approved org (Module 9). */
  async suspend(organizationId: string, actor: Actor, reason: string) {
    const updated = await kycProfileRepository.update(organizationId, {
      status: "SUSPENDED",
      rejectionReason: reason,
      lastEvaluatedAt: new Date(),
    });
    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "UPDATE",
      entity: "kyc_profile",
      entityId: organizationId,
      description: `KYC suspended: ${reason}`,
    });
    return updated;
  },

  /** Explicit resubmission after rejection — clears the terminal state back to DRAFT. */
  async resubmit(organizationId: string, actor: Actor) {
    const updated = await kycProfileRepository.update(organizationId, {
      status: "DRAFT",
      rejectionReason: null,
      submittedAt: null,
      approvedAt: null,
    });
    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "UPDATE",
      entity: "kyc_profile",
      entityId: organizationId,
      description: "KYC resubmission started after rejection",
    });
    return updated;
  },
};
