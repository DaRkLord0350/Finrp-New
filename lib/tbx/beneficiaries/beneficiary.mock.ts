// ============================================================
// FinRP — MockTbxBeneficiaryProvider
//
// Deterministic canned beneficiary lifecycle responses for
// development/tests, since TBX has provided no sandbox credentials
// or test environment for its Beneficiary Management API. Kept as a
// fully separate implementation of TbxBeneficiaryProvider (not
// `if (mock)` branches inside the real client) — selected via
// lib/tbx/beneficiaries/index.ts's registry based on
// TBX_BANKING_MOCK_MODE. Mirrors lib/tbx/balance/balance.mock.ts's
// convention.
//
// Deliberate-failure test hook (mirrors lib/tbx/mock-provider.ts's
// Phase 1 convention): an account number ending in "0" fails
// verification, so tests/dev can exercise the FAILED path on demand.
// ============================================================

import type {
  CreateBeneficiaryInput,
  CreateBeneficiaryResult,
  VerifyBeneficiaryInput,
  VerifyBeneficiaryResult,
  FetchBeneficiaryStatusInput,
  FetchBeneficiaryStatusResult,
  TbxBeneficiaryProvider,
} from "./beneficiary.types";

/** Deterministic per-vendor "randomness" so repeated calls move predictably. */
function pseudoRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 10_000) / 10_000; // 0..1
}

function mockTbxBeneficiaryId(vendorId: string): string {
  return `MOCK-BEN-${vendorId.slice(-10).toUpperCase()}`;
}

export class MockTbxBeneficiaryProvider implements TbxBeneficiaryProvider {
  readonly name = "TBX_BENEFICIARY_MOCK" as const;

  async createBeneficiary(input: CreateBeneficiaryInput): Promise<CreateBeneficiaryResult> {
    const tbxBeneficiaryId = mockTbxBeneficiaryId(input.vendorId);
    return {
      outcome: "SUCCESS",
      tbxBeneficiaryId,
      status: "PENDING",
      raw: { mock: true, vendorId: input.vendorId, tbxBeneficiaryId, status: "PENDING", createdAt: new Date().toISOString() },
    };
  }

  async verifyBeneficiary(input: VerifyBeneficiaryInput): Promise<VerifyBeneficiaryResult> {
    const willFail = /0$/.test(input.tbxBeneficiaryId.trim());
    const r = pseudoRandom(input.tbxBeneficiaryId);

    if (willFail) {
      return {
        outcome: "SUCCESS",
        verificationStatus: "FAILED",
        raw: { mock: true, tbxBeneficiaryId: input.tbxBeneficiaryId, verificationStatus: "FAILED", reason: "Name/account mismatch" },
      };
    }

    return {
      outcome: "SUCCESS",
      verificationStatus: "VERIFIED",
      verifiedAccountHolderName: "Verified (mock)",
      nameMatchScore: 85 + Math.floor(r * 15), // 85-99
      raw: { mock: true, tbxBeneficiaryId: input.tbxBeneficiaryId, verificationStatus: "VERIFIED" },
    };
  }

  async fetchBeneficiaryStatus(input: FetchBeneficiaryStatusInput): Promise<FetchBeneficiaryStatusResult> {
    const willFail = /0$/.test(input.tbxBeneficiaryId.trim());

    if (willFail) {
      return {
        outcome: "SUCCESS",
        beneficiaryStatus: "FAILED",
        verificationStatus: "FAILED",
        approvalStatus: "REJECTED",
        raw: { mock: true, tbxBeneficiaryId: input.tbxBeneficiaryId, beneficiaryStatus: "FAILED" },
      };
    }

    return {
      outcome: "SUCCESS",
      beneficiaryStatus: "ACTIVE",
      verificationStatus: "VERIFIED",
      approvalStatus: "APPROVED",
      raw: { mock: true, tbxBeneficiaryId: input.tbxBeneficiaryId, beneficiaryStatus: "ACTIVE", approvalStatus: "APPROVED" },
    };
  }
}
