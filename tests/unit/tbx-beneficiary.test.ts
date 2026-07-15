// ============================================================
// Unit tests — lib/tbx/beneficiaries/*
// Mock provider determinism (incl. the deliberate-failure hook),
// mapper correctness, and the real client's "no fabricated
// endpoints" guarantee (Phase 2C).
// ============================================================

import { describe, it, expect } from "vitest";
import { MockTbxBeneficiaryProvider } from "@/lib/tbx/beneficiaries/beneficiary.mock";
import { TbxBeneficiaryHttpClient } from "@/lib/tbx/beneficiaries/beneficiary.client";
import { TbxBeneficiaryEndpointNotBoundError } from "@/lib/tbx/beneficiaries/beneficiary.types";
import { toVendorUpdateFromCreate, toVendorUpdateFromVerify, toVendorUpdateFromStatus } from "@/lib/tbx/beneficiaries/beneficiary.mapper";

describe("MockTbxBeneficiaryProvider", () => {
  it("creates a beneficiary with a PENDING status", async () => {
    const provider = new MockTbxBeneficiaryProvider();
    const result = await provider.createBeneficiary({
      organizationId: "org_test",
      vendorId: "vendor_test_123",
      beneficiaryName: "Acme Supplies",
      accountNumber: "1234567891",
      ifscCode: "HDFC0000001",
    });

    expect(result.outcome).toBe("SUCCESS");
    expect(result.tbxBeneficiaryId).toBeTruthy();
    expect(result.status).toBe("PENDING");
  });

  it("is deterministic — the same vendor always maps to the same beneficiary id", async () => {
    const provider = new MockTbxBeneficiaryProvider();
    const a = await provider.createBeneficiary({ organizationId: "org_test", vendorId: "vendor_abc", beneficiaryName: "A", accountNumber: "111", ifscCode: "X" });
    const b = await provider.createBeneficiary({ organizationId: "org_test", vendorId: "vendor_abc", beneficiaryName: "A", accountNumber: "111", ifscCode: "X" });
    expect(a.tbxBeneficiaryId).toBe(b.tbxBeneficiaryId);
  });

  it("verifies successfully for a beneficiary id not ending in 0", async () => {
    const provider = new MockTbxBeneficiaryProvider();
    const result = await provider.verifyBeneficiary({ organizationId: "org_test", vendorId: "vendor_test_123", tbxBeneficiaryId: "MOCK-BEN-0000000123" });
    expect(result.outcome).toBe("SUCCESS");
    expect(result.verificationStatus).toBe("VERIFIED");
  });

  it("deliberately fails verification for a beneficiary id ending in 0 (test hook)", async () => {
    const provider = new MockTbxBeneficiaryProvider();
    const result = await provider.verifyBeneficiary({ organizationId: "org_test", vendorId: "vendor_test_123", tbxBeneficiaryId: "MOCK-BEN-0000000120" });
    expect(result.outcome).toBe("SUCCESS");
    expect(result.verificationStatus).toBe("FAILED");
  });

  it("reports ACTIVE + APPROVED status for a healthy beneficiary", async () => {
    const provider = new MockTbxBeneficiaryProvider();
    const result = await provider.fetchBeneficiaryStatus({ organizationId: "org_test", vendorId: "vendor_test_123", tbxBeneficiaryId: "MOCK-BEN-0000000123" });
    expect(result.beneficiaryStatus).toBe("ACTIVE");
    expect(result.approvalStatus).toBe("APPROVED");
  });
});

describe("beneficiary mapper", () => {
  it("maps a successful create result to a Vendor update", async () => {
    const provider = new MockTbxBeneficiaryProvider();
    const result = await provider.createBeneficiary({ organizationId: "org_test", vendorId: "vendor_test_123", beneficiaryName: "A", accountNumber: "111", ifscCode: "X" });
    const update = toVendorUpdateFromCreate(result);
    expect(update.tbxBeneficiaryStatus).toBe("PENDING");
    expect(update.tbxBeneficiaryId).toBe(result.tbxBeneficiaryId);
  });

  it("maps a successful verify result to a Vendor update", async () => {
    const provider = new MockTbxBeneficiaryProvider();
    const result = await provider.verifyBeneficiary({ organizationId: "org_test", vendorId: "vendor_test_123", tbxBeneficiaryId: "MOCK-BEN-0000000123" });
    const update = toVendorUpdateFromVerify(result);
    expect(update.tbxVerificationStatus).toBe("VERIFIED");
  });

  it("maps a successful status result to a Vendor update", async () => {
    const provider = new MockTbxBeneficiaryProvider();
    const result = await provider.fetchBeneficiaryStatus({ organizationId: "org_test", vendorId: "vendor_test_123", tbxBeneficiaryId: "MOCK-BEN-0000000123" });
    const update = toVendorUpdateFromStatus(result);
    expect(update.tbxBeneficiaryStatus).toBe("ACTIVE");
    expect(update.tbxApprovalStatus).toBe("APPROVED");
  });

  it("refuses to map a failed result", () => {
    expect(() => toVendorUpdateFromCreate({ outcome: "FAILED", raw: null })).toThrow();
    expect(() => toVendorUpdateFromVerify({ outcome: "FAILED", raw: null })).toThrow();
    expect(() => toVendorUpdateFromStatus({ outcome: "FAILED", raw: null })).toThrow();
  });
});

describe("TbxBeneficiaryHttpClient — no fabricated endpoints", () => {
  it("throws TbxBeneficiaryEndpointNotBoundError instead of guessing a real HTTP call", async () => {
    const client = new TbxBeneficiaryHttpClient();
    await expect(
      client.createBeneficiary({ organizationId: "org_test", vendorId: "vendor_test_123", beneficiaryName: "A", accountNumber: "111", ifscCode: "X" })
    ).rejects.toThrow(TbxBeneficiaryEndpointNotBoundError);
    await expect(
      client.verifyBeneficiary({ organizationId: "org_test", vendorId: "vendor_test_123", tbxBeneficiaryId: "MOCK-1" })
    ).rejects.toThrow(TbxBeneficiaryEndpointNotBoundError);
    await expect(
      client.fetchBeneficiaryStatus({ organizationId: "org_test", vendorId: "vendor_test_123", tbxBeneficiaryId: "MOCK-1" })
    ).rejects.toThrow(TbxBeneficiaryEndpointNotBoundError);
  });
});
