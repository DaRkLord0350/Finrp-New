// ============================================================
// FinRP — TBX Beneficiary mapper
// Normalizes provider results into the Vendor update shape
// beneficiary.service.ts persists. Vendor is the sole source of
// truth for beneficiary state (see prisma/schema.prisma).
// ============================================================

import type { Prisma, TbxBeneficiaryStatus, TbxVerificationStatus, TbxBeneficiaryApprovalStatus } from "@prisma/client";
import type { CreateBeneficiaryResult, VerifyBeneficiaryResult, FetchBeneficiaryStatusResult } from "./beneficiary.types";

export interface VendorBeneficiaryUpdateData {
  tbxBeneficiaryId?: string;
  tbxBeneficiaryStatus?: TbxBeneficiaryStatus;
  tbxVerificationStatus?: TbxVerificationStatus;
  tbxApprovalStatus?: TbxBeneficiaryApprovalStatus;
  tbxLastSyncAt: Date;
  tbxMetadata: Prisma.InputJsonValue;
}

function asJson(raw: unknown): Prisma.InputJsonValue {
  return (raw ?? {}) as Prisma.InputJsonValue;
}

export function toVendorUpdateFromCreate(result: CreateBeneficiaryResult): VendorBeneficiaryUpdateData {
  if (result.outcome !== "SUCCESS" || !result.tbxBeneficiaryId) {
    throw new Error("Cannot map a failed CreateBeneficiaryResult to a Vendor update");
  }
  return {
    tbxBeneficiaryId: result.tbxBeneficiaryId,
    tbxBeneficiaryStatus: "PENDING",
    tbxLastSyncAt: new Date(),
    tbxMetadata: asJson(result.raw),
  };
}

export function toVendorUpdateFromVerify(result: VerifyBeneficiaryResult): VendorBeneficiaryUpdateData {
  if (result.outcome !== "SUCCESS" || !result.verificationStatus) {
    throw new Error("Cannot map a failed VerifyBeneficiaryResult to a Vendor update");
  }
  return {
    tbxVerificationStatus: result.verificationStatus,
    tbxLastSyncAt: new Date(),
    tbxMetadata: asJson(result.raw),
  };
}

export function toVendorUpdateFromStatus(result: FetchBeneficiaryStatusResult): VendorBeneficiaryUpdateData {
  if (result.outcome !== "SUCCESS") {
    throw new Error("Cannot map a failed FetchBeneficiaryStatusResult to a Vendor update");
  }
  return {
    tbxBeneficiaryStatus: result.beneficiaryStatus,
    tbxVerificationStatus: result.verificationStatus,
    tbxApprovalStatus: result.approvalStatus,
    tbxLastSyncAt: new Date(),
    tbxMetadata: asJson(result.raw),
  };
}
