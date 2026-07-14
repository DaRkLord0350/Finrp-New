// ============================================================
// lib/tbx/service.ts
//
// The internal interface everything else in FinRP calls to talk to
// TBX — hides the real HTTP contract (lib/tbx/provider.ts) and
// unconditionally logs every call (Module 8, lib/tbx/logging.ts).
// Callers never import lib/tbx/provider.ts or lib/tbx/index.ts
// directly; they call these functions.
// ============================================================

import { getTbxProvider } from "./index";
import { withTbxLogging, type TbxLogContext } from "./logging";
import type {
  CreateTbxCustomerInput,
  CreateTbxCustomerResult,
  FetchCkycInput,
  FetchCkycResult,
  FetchDirectorInput,
  FetchDirectorResult,
  ScreenAmlPepInput,
  ScreenAmlPepResult,
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

export interface TbxCallOptions {
  organizationId: string;
  userId?: string | null;
  /** e.g. "organization" | "related_party" | "bank_account" */
  subjectType?: string;
  subjectId?: string;
  backgroundJobId?: string;
}

function ctx(apiName: string, opts: TbxCallOptions): TbxLogContext {
  return {
    apiName,
    organizationId: opts.organizationId,
    userId: opts.userId ?? null,
    subjectType: opts.subjectType ?? null,
    subjectId: opts.subjectId ?? null,
    backgroundJobId: opts.backgroundJobId ?? null,
  };
}

export async function verifyPan(input: VerifyPanInput, opts: TbxCallOptions): Promise<VerifyPanResult> {
  const provider = getTbxProvider();
  return withTbxLogging(ctx("Business PAN", opts), input, () => provider.verifyPan(input));
}

export async function verifyGstin(input: VerifyGstinInput, opts: TbxCallOptions): Promise<VerifyGstinResult> {
  const provider = getTbxProvider();
  return withTbxLogging(ctx("GST Verification", opts), input, () => provider.verifyGstin(input));
}

export async function verifyCin(input: VerifyCinInput, opts: TbxCallOptions): Promise<VerifyCinResult> {
  const provider = getTbxProvider();
  return withTbxLogging(ctx("CIN Number Lookup", opts), input, () => provider.verifyCin(input));
}

export async function verifyAadhaar(input: VerifyAadhaarInput, opts: TbxCallOptions): Promise<VerifyAadhaarResult> {
  const provider = getTbxProvider();
  // Never log the raw XML/share code — redaction.ts also strips these by key
  // name, but omit them from the logged request payload entirely as well.
  const loggedInput = { hasOfflineXml: Boolean(input.offlineXmlBase64) };
  return withTbxLogging(ctx("Aadhaar Paperless Offline KYC (eKYC) API", opts), loggedInput, () =>
    provider.verifyAadhaar(input)
  );
}

export async function verifyBankAccount(
  input: VerifyBankAccountInput,
  opts: TbxCallOptions
): Promise<VerifyBankAccountResult> {
  const provider = getTbxProvider();
  const apiName = input.method === "PENNY_DROP" ? "Pennydrop BAV" : "Penniless BAV";
  return withTbxLogging(ctx(apiName, opts), input, () => provider.verifyBankAccount(input));
}

export async function fetchDirector(input: FetchDirectorInput, opts: TbxCallOptions): Promise<FetchDirectorResult> {
  const provider = getTbxProvider();
  return withTbxLogging(ctx("Director Details (MCA DIN based)", opts), input, () => provider.fetchDirector(input));
}

export async function fetchCkyc(input: FetchCkycInput, opts: TbxCallOptions): Promise<FetchCkycResult> {
  const provider = getTbxProvider();
  return withTbxLogging(ctx("Simple CKYC Search & Download API", opts), input, () => provider.fetchCkyc(input));
}

export async function screenAmlPep(input: ScreenAmlPepInput, opts: TbxCallOptions): Promise<ScreenAmlPepResult> {
  const provider = getTbxProvider();
  return withTbxLogging(ctx("Aml And Pep Verification (India)", opts), input, () => provider.screenAmlPep(input));
}

export async function createTbxCustomer(
  input: CreateTbxCustomerInput,
  opts: TbxCallOptions
): Promise<CreateTbxCustomerResult> {
  const provider = getTbxProvider();
  return withTbxLogging(ctx("Customer Onboarding", opts), input, () => provider.createCustomer(input));
}
