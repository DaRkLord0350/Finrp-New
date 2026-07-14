// ============================================================
// FinRP — MockTbxProvider
//
// Deterministic canned responses for development/tests, since TBX
// has provided no sandbox credentials or test environment. Kept as
// a fully separate implementation of TbxProvider (not `if (mock)`
// branches inside TbxHttpProvider) so the real provider stays a
// pure HTTP client — selected via lib/tbx/index.ts's registry based
// on TBX_MOCK_MODE.
//
// Rule of thumb: PAN/GSTIN/account numbers ending in a digit that
// looks like a deliberate test case fail; everything else verifies.
// This lets wizard/E2E tests exercise both the happy path and the
// rejection path without special-casing test fixtures elsewhere.
// ============================================================

import { randomUUID } from "crypto";
import type {
  CreateTbxCustomerInput,
  CreateTbxCustomerResult,
  FetchCkycInput,
  FetchCkycResult,
  FetchDirectorInput,
  FetchDirectorResult,
  ScreenAmlPepInput,
  ScreenAmlPepResult,
  TbxProvider,
  VerifyAadhaarInput,
  VerifyAadhaarResult,
  VerifyBankAccountInput,
  VerifyBankAccountResult,
  VerifyCinInput,
  VerifyCinResult,
  VerifyGstinInput,
  VerifyGstinResult,
  VerifyPanInput,
  VerifyPanResult,
} from "./types";

function shouldFail(value: string): boolean {
  // Deliberate test-failure convention: any identifier ending in "0".
  return /0$/.test(value.trim());
}

function refId(): string {
  return `mock_${randomUUID()}`;
}

export class MockTbxProvider implements TbxProvider {
  readonly name = "TBX_MOCK" as const;

  async verifyPan(input: VerifyPanInput): Promise<VerifyPanResult> {
    const ok = !shouldFail(input.pan);
    return {
      outcome: ok ? "VERIFIED" : "FAILED",
      referenceId: refId(),
      registeredName: ok ? input.nameToMatch ?? "MOCK REGISTERED NAME" : undefined,
      nameMatchScore: ok ? 96 : undefined,
      panStatus: ok ? "ACTIVE" : "INOPERATIVE",
      panType: "Company",
      raw: { mock: true, pan: input.pan },
    };
  }

  async verifyGstin(input: VerifyGstinInput): Promise<VerifyGstinResult> {
    const ok = !shouldFail(input.gstin);
    return {
      outcome: ok ? "VERIFIED" : "FAILED",
      referenceId: refId(),
      legalName: ok ? "MOCK LEGAL NAME PRIVATE LIMITED" : undefined,
      tradeName: ok ? "Mock Trade Name" : undefined,
      gstinStatus: ok ? "Active" : "Cancelled",
      registrationDate: ok ? "2020-01-01" : undefined,
      natureOfBusiness: ok ? ["Service Provider"] : undefined,
      raw: { mock: true, gstin: input.gstin },
    };
  }

  async verifyCin(input: VerifyCinInput): Promise<VerifyCinResult> {
    const ok = !shouldFail(input.cin);
    return {
      outcome: ok ? "VERIFIED" : "FAILED",
      referenceId: refId(),
      companyName: ok ? "MOCK COMPANY PRIVATE LIMITED" : undefined,
      companyStatus: ok ? "Active" : "Struck Off",
      incorporationDate: ok ? "2018-06-15" : undefined,
      companyType: "Private Limited Company",
      raw: { mock: true, cin: input.cin },
    };
  }

  async verifyAadhaar(_input: VerifyAadhaarInput): Promise<VerifyAadhaarResult> {
    void _input; // mock always returns the same canned result regardless of input
    return {
      outcome: "VERIFIED",
      referenceId: refId(),
      name: "MOCK AADHAAR NAME",
      dob: "1990-01-01",
      gender: "M",
      address: "Mock Address, Mock City, Mock State",
      aadhaarLast4: "1234",
      raw: { mock: true },
    };
  }

  async verifyBankAccount(input: VerifyBankAccountInput): Promise<VerifyBankAccountResult> {
    const ok = !shouldFail(input.accountNumber);
    return {
      outcome: ok ? "VERIFIED" : "FAILED",
      referenceId: refId(),
      verifiedAccountHolderName: ok ? input.nameToMatch ?? "MOCK ACCOUNT HOLDER" : undefined,
      nameMatchScore: ok ? 94 : undefined,
      bankName: ok ? "Mock Bank" : undefined,
      branchName: ok ? "Mock Branch" : undefined,
      raw: { mock: true, method: input.method },
    };
  }

  async fetchDirector(input: FetchDirectorInput): Promise<FetchDirectorResult> {
    const ok = !shouldFail(input.din);
    return {
      outcome: ok ? "VERIFIED" : "FAILED",
      referenceId: refId(),
      name: ok ? "MOCK DIRECTOR NAME" : undefined,
      status: ok ? "Approved" : "Disqualified",
      associatedCompanies: ok ? ["MOCK COMPANY PRIVATE LIMITED"] : undefined,
      raw: { mock: true, din: input.din },
    };
  }

  async fetchCkyc(input: FetchCkycInput): Promise<FetchCkycResult> {
    return {
      outcome: "VERIFIED",
      referenceId: refId(),
      found: true,
      ckycNumber: `CKYC${(input.pan ?? "MOCK").slice(0, 6)}`,
      name: "MOCK CKYC NAME",
      raw: { mock: true },
    };
  }

  async screenAmlPep(input: ScreenAmlPepInput): Promise<ScreenAmlPepResult> {
    const isMatch = shouldFail(input.name);
    return {
      outcome: isMatch ? "FAILED" : "VERIFIED",
      referenceId: refId(),
      isMatch,
      riskLevel: isMatch ? "HIGH" : "LOW",
      matches: isMatch ? [{ list: "MOCK-PEP-LIST", matchedName: input.name, score: 88 }] : [],
      raw: { mock: true, name: input.name },
    };
  }

  async createCustomer(input: CreateTbxCustomerInput): Promise<CreateTbxCustomerResult> {
    return {
      outcome: "PENDING",
      referenceId: refId(),
      tbxCustomerId: `mock_cust_${input.organizationId}`,
      tbxOrganizationId: `mock_org_${input.organizationId}`,
      tbxStatus: "PENDING_REVIEW",
      raw: { mock: true, legalName: input.legalName },
    };
  }
}
