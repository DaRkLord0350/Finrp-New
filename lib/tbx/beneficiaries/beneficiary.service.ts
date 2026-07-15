// ============================================================
// FinRP — TBX Beneficiary service
// Orchestration: call the provider (mock or real), persist the
// result onto Vendor (the sole source of truth — no separate
// beneficiary master), and write an audit trail for every
// create/verify/approve/reject/sync event.
// ============================================================

import { prisma } from "@/lib/prisma";
import { createBankingLogger } from "@/lib/banking/logger";
import { createAuditLog } from "@/lib/audit";
import { getTbxBeneficiaryProvider } from "./index";
import { toVendorUpdateFromCreate, toVendorUpdateFromVerify, toVendorUpdateFromStatus } from "./beneficiary.mapper";
import { TbxBeneficiaryProviderError } from "./beneficiary.types";

const log = createBankingLogger("tbx-beneficiary");

export interface BeneficiaryActionOutcome {
  status: "SUCCESS" | "FAILED";
  vendorId: string;
  error?: string;
  errorCode?: string;
}

interface Actor {
  userId?: string | null;
}

async function findVendor(organizationId: string, vendorId: string) {
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, organizationId, deletedAt: null },
  });
  if (!vendor) {
    throw new Error(`Vendor ${vendorId} not found in organization ${organizationId}`);
  }
  return vendor;
}

async function markFailed(vendorId: string, status: "PENDING" | "FAILED", message: string) {
  await prisma.vendor
    .update({
      where: { id: vendorId },
      data: { tbxBeneficiaryStatus: status, tbxLastSyncAt: new Date() },
    })
    .catch(() => {});
  void message;
}

/** Register the vendor's existing bank details as a TBX beneficiary. */
export async function createVendorBeneficiary(
  organizationId: string,
  vendorId: string,
  actor: Actor = {}
): Promise<BeneficiaryActionOutcome> {
  const vendor = await findVendor(organizationId, vendorId);

  if (!vendor.bankAccount || !vendor.bankIFSC) {
    const message = "Vendor is missing bank account number / IFSC — cannot create a TBX beneficiary";
    await markFailed(vendorId, "FAILED", message);
    log.warn("beneficiary create skipped — missing bank details", { organizationId, vendorId });
    return { status: "FAILED", vendorId, error: message, errorCode: "MISSING_BANK_DETAILS" };
  }

  try {
    const provider = getTbxBeneficiaryProvider();
    const result = await provider.createBeneficiary({
      organizationId,
      vendorId,
      beneficiaryName: vendor.name,
      accountNumber: vendor.bankAccount,
      ifscCode: vendor.bankIFSC,
      bankName: vendor.bankName ?? undefined,
    });

    if (result.outcome !== "SUCCESS") {
      throw new TbxBeneficiaryProviderError({ message: "TBX reported a failed beneficiary creation", code: "CREATE_FAILED" });
    }

    const update = toVendorUpdateFromCreate(result);
    await prisma.vendor.update({ where: { id: vendorId }, data: update });

    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "CREATE",
      entity: "vendor_beneficiary",
      entityId: vendorId,
      description: `TBX beneficiary created for vendor "${vendor.name}"`,
      newValue: { tbxBeneficiaryId: update.tbxBeneficiaryId, status: update.tbxBeneficiaryStatus },
    });

    log.info("beneficiary created", { organizationId, vendorId, tbxBeneficiaryId: update.tbxBeneficiaryId });
    return { status: "SUCCESS", vendorId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorCode = err instanceof TbxBeneficiaryProviderError ? err.code : "CREATE_ERROR";
    await markFailed(vendorId, "FAILED", message);
    log.error("beneficiary create failed", { organizationId, vendorId, errorCode, error: message });
    return { status: "FAILED", vendorId, error: message, errorCode };
  }
}

/** Trigger (or check) bank-account verification for an existing TBX beneficiary. */
export async function verifyVendorBeneficiary(
  organizationId: string,
  vendorId: string,
  actor: Actor = {}
): Promise<BeneficiaryActionOutcome> {
  const vendor = await findVendor(organizationId, vendorId);
  if (!vendor.tbxBeneficiaryId) {
    throw new Error(`Vendor ${vendorId} has no TBX beneficiary to verify — create one first`);
  }

  try {
    const provider = getTbxBeneficiaryProvider();
    const result = await provider.verifyBeneficiary({ organizationId, vendorId, tbxBeneficiaryId: vendor.tbxBeneficiaryId });

    if (result.outcome !== "SUCCESS") {
      throw new TbxBeneficiaryProviderError({ message: "TBX reported a failed verification attempt", code: "VERIFY_FAILED" });
    }

    const update = toVendorUpdateFromVerify(result);
    await prisma.vendor.update({ where: { id: vendorId }, data: update });

    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "VERIFY",
      entity: "vendor_beneficiary",
      entityId: vendorId,
      description: `TBX beneficiary verification for vendor "${vendor.name}" — ${update.tbxVerificationStatus}`,
      newValue: { verificationStatus: update.tbxVerificationStatus, nameMatchScore: result.nameMatchScore },
    });

    log.info("beneficiary verified", { organizationId, vendorId, verificationStatus: update.tbxVerificationStatus });
    return { status: "SUCCESS", vendorId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorCode = err instanceof TbxBeneficiaryProviderError ? err.code : "VERIFY_ERROR";
    log.error("beneficiary verify failed", { organizationId, vendorId, errorCode, error: message });
    return { status: "FAILED", vendorId, error: message, errorCode };
  }
}

/** Refresh beneficiary/verification/approval status from TBX. Used by the manual "Sync" action and both background crons. */
export async function syncVendorBeneficiary(
  organizationId: string,
  vendorId: string,
  actor: Actor = {}
): Promise<BeneficiaryActionOutcome> {
  const vendor = await findVendor(organizationId, vendorId);
  if (!vendor.tbxBeneficiaryId) {
    throw new Error(`Vendor ${vendorId} has no TBX beneficiary to sync — create one first`);
  }

  try {
    const provider = getTbxBeneficiaryProvider();
    const result = await provider.fetchBeneficiaryStatus({ organizationId, vendorId, tbxBeneficiaryId: vendor.tbxBeneficiaryId });

    if (result.outcome !== "SUCCESS") {
      throw new TbxBeneficiaryProviderError({ message: "TBX reported a failed status fetch", code: "SYNC_FAILED" });
    }

    const update = toVendorUpdateFromStatus(result);
    const previousApproval = vendor.tbxApprovalStatus;
    await prisma.vendor.update({ where: { id: vendorId }, data: update });

    if (update.tbxApprovalStatus && update.tbxApprovalStatus !== previousApproval) {
      if (update.tbxApprovalStatus === "APPROVED") {
        await createAuditLog({
          organizationId,
          userId: actor.userId ?? undefined,
          action: "APPROVE",
          entity: "vendor_beneficiary",
          entityId: vendorId,
          description: `TBX approved vendor "${vendor.name}" as a payable beneficiary — ready for payments`,
        });
      } else if (update.tbxApprovalStatus === "REJECTED") {
        await createAuditLog({
          organizationId,
          userId: actor.userId ?? undefined,
          action: "REJECT",
          entity: "vendor_beneficiary",
          entityId: vendorId,
          description: `TBX rejected vendor "${vendor.name}" as a payable beneficiary`,
        });
      }
    }

    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "SYNC",
      entity: "vendor_beneficiary",
      entityId: vendorId,
      description: `TBX beneficiary status synced for vendor "${vendor.name}"`,
      newValue: {
        beneficiaryStatus: update.tbxBeneficiaryStatus,
        verificationStatus: update.tbxVerificationStatus,
        approvalStatus: update.tbxApprovalStatus,
      },
    });

    log.info("beneficiary synced", { organizationId, vendorId, status: update.tbxBeneficiaryStatus });
    return { status: "SUCCESS", vendorId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorCode = err instanceof TbxBeneficiaryProviderError ? err.code : "SYNC_ERROR";

    // A failed sync attempt is not new information about the beneficiary
    // itself — leave tbxBeneficiaryStatus untouched so a transient network
    // error can never overwrite a previously-confirmed ACTIVE/APPROVED
    // state. Only the attempt is logged; the retry-failed-syncs cron uses
    // tbxLastSyncAt (unchanged here) to keep finding this vendor due.
    log.error("beneficiary sync failed", { organizationId, vendorId, errorCode, error: message });
    return { status: "FAILED", vendorId, error: message, errorCode };
  }
}
