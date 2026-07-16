// ============================================================
// lib/verification/service.ts
//
// One runner function per VerificationCheckType, all funnelling into
// persistCheck(). Each VerificationCheck row is immutable-per-attempt
// (a re-check creates a new row) EXCEPT the OTP flow, where confirm
// updates the same PENDING row created by send — the "attempt" there
// is the whole send+confirm cycle, not each keystroke.
//
// TBX-backed checks (PAN/GSTIN/CIN/AADHAAR/BANK_ACCOUNT/DIRECTOR_DIN/
// CKYC) reuse lib/tbx/service.ts directly — never duplicated. A TBX
// call either resolves with an outcome (VERIFIED/FAILED/PENDING,
// persisted as-is) or throws a genuine infra error (TBX not
// configured), which is NOT caught here — it propagates to the route
// so mapVerificationError's generic fallback surfaces it, same
// precedent as lib/aml/service.ts's screenAmlPep call.
//
// The two checks native to this module (IFSC, Identity Document) DO
// use the Provider Pattern's fail-loud-until-bound errors, so those
// runners persist a FAILED row with the reason AND rethrow — the
// caller gets both a correct HTTP status and an audit trail.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { VerificationCheckType, VerificationCheckSource, TbxVerificationStatus, Prisma } from "@prisma/client";
import * as tbx from "@/lib/tbx/service";
import * as workflow from "@/lib/lending/workflow/service";
import { createAuditLog } from "@/lib/audit";
import { getCase, markInProgress } from "./case-service";
import { lookupIfsc } from "./ifsc/service";
import { crossCheckAddresses, type AddressSource } from "./address/cross-check";
import { getIdentityDocumentProvider } from "./identity-document";
import type { IdentityDocumentType } from "./identity-document/types";
import { issueChallenge, confirmChallenge, dispatchPhoneOtp, dispatchEmailOtp, type OtpChallenge } from "./otp/service";

export type CheckActor = { userId: string };

async function persistCheck(params: {
  caseId: string;
  organizationId: string;
  checkType: VerificationCheckType;
  source: VerificationCheckSource;
  status: TbxVerificationStatus;
  referenceId?: string | null;
  resultSummary?: Prisma.InputJsonValue;
  failureReason?: string | null;
  performedById: string;
}) {
  const check = await prisma.verificationCheck.create({
    data: {
      caseId: params.caseId,
      organizationId: params.organizationId,
      checkType: params.checkType,
      source: params.source,
      status: params.status,
      referenceId: params.referenceId ?? undefined,
      resultSummary: params.resultSummary ?? undefined,
      failureReason: params.failureReason ?? undefined,
      performedById: params.performedById,
    },
  });
  await markInProgress(params.caseId);
  return check;
}

function tbxCtx(kase: { organizationId: string; subjectType: string; subjectId: string }, actor: CheckActor) {
  return { organizationId: kase.organizationId, userId: actor.userId, subjectType: kase.subjectType.toLowerCase(), subjectId: kase.subjectId };
}

// ── TBX-backed identity/company/bank checks ───────────────────────

export async function runPanCheck(caseId: string, organizationId: string, input: { pan: string; nameToMatch?: string }, actor: CheckActor) {
  const kase = await getCase(caseId, organizationId);
  const result = await tbx.verifyPan({ pan: input.pan, nameToMatch: input.nameToMatch }, tbxCtx(kase, actor));
  return persistCheck({
    caseId: kase.id,
    organizationId,
    checkType: "PAN",
    source: "TBX",
    status: result.outcome,
    referenceId: result.referenceId,
    resultSummary: { registeredName: result.registeredName ?? null, nameMatchScore: result.nameMatchScore ?? null, panStatus: result.panStatus ?? null, panType: result.panType ?? null },
    performedById: actor.userId,
  });
}

export async function runGstinCheck(caseId: string, organizationId: string, input: { gstin: string }, actor: CheckActor) {
  const kase = await getCase(caseId, organizationId);
  const result = await tbx.verifyGstin({ gstin: input.gstin }, tbxCtx(kase, actor));
  return persistCheck({
    caseId: kase.id,
    organizationId,
    checkType: "GSTIN",
    source: "TBX",
    status: result.outcome,
    referenceId: result.referenceId,
    resultSummary: { legalName: result.legalName ?? null, tradeName: result.tradeName ?? null, gstinStatus: result.gstinStatus ?? null, registrationDate: result.registrationDate ?? null },
    performedById: actor.userId,
  });
}

export async function runCinCheck(caseId: string, organizationId: string, input: { cin: string }, actor: CheckActor) {
  const kase = await getCase(caseId, organizationId);
  const result = await tbx.verifyCin({ cin: input.cin }, tbxCtx(kase, actor));
  return persistCheck({
    caseId: kase.id,
    organizationId,
    checkType: "CIN",
    source: "TBX",
    status: result.outcome,
    referenceId: result.referenceId,
    resultSummary: { companyName: result.companyName ?? null, companyStatus: result.companyStatus ?? null, incorporationDate: result.incorporationDate ?? null, companyType: result.companyType ?? null },
    performedById: actor.userId,
  });
}

export async function runAadhaarCheck(caseId: string, organizationId: string, input: { offlineXmlBase64: string; shareCode: string }, actor: CheckActor) {
  const kase = await getCase(caseId, organizationId);
  const result = await tbx.verifyAadhaar({ offlineXmlBase64: input.offlineXmlBase64, shareCode: input.shareCode }, tbxCtx(kase, actor));
  return persistCheck({
    caseId: kase.id,
    organizationId,
    checkType: "AADHAAR",
    source: "TBX",
    status: result.outcome,
    referenceId: result.referenceId,
    resultSummary: { name: result.name ?? null, dob: result.dob ?? null, address: result.address ?? null, aadhaarLast4: result.aadhaarLast4 ?? null },
    performedById: actor.userId,
  });
}

export async function runBankAccountCheck(
  caseId: string,
  organizationId: string,
  input: { accountNumber: string; ifsc: string; method: "PENNY_DROP" | "PENNILESS_BAV"; nameToMatch?: string },
  actor: CheckActor
) {
  const kase = await getCase(caseId, organizationId);
  const result = await tbx.verifyBankAccount(input, tbxCtx(kase, actor));
  return persistCheck({
    caseId: kase.id,
    organizationId,
    checkType: "BANK_ACCOUNT",
    source: "TBX",
    status: result.outcome,
    referenceId: result.referenceId,
    resultSummary: { verifiedAccountHolderName: result.verifiedAccountHolderName ?? null, nameMatchScore: result.nameMatchScore ?? null, bankName: result.bankName ?? null, branchName: result.branchName ?? null },
    performedById: actor.userId,
  });
}

export async function runDirectorDinCheck(caseId: string, organizationId: string, input: { din: string }, actor: CheckActor) {
  const kase = await getCase(caseId, organizationId);
  const result = await tbx.fetchDirector({ din: input.din }, tbxCtx(kase, actor));
  return persistCheck({
    caseId: kase.id,
    organizationId,
    checkType: "DIRECTOR_DIN",
    source: "TBX",
    status: result.outcome,
    referenceId: result.referenceId,
    resultSummary: { name: result.name ?? null, status: result.status ?? null, associatedCompanies: result.associatedCompanies ?? [] },
    performedById: actor.userId,
  });
}

export async function runCkycCheck(caseId: string, organizationId: string, input: { pan?: string; ckycNumber?: string }, actor: CheckActor) {
  const kase = await getCase(caseId, organizationId);
  const result = await tbx.fetchCkyc({ pan: input.pan, ckycNumber: input.ckycNumber }, tbxCtx(kase, actor));
  return persistCheck({
    caseId: kase.id,
    organizationId,
    checkType: "CKYC",
    source: "TBX",
    status: result.outcome,
    referenceId: result.referenceId,
    resultSummary: { found: result.found, ckycNumber: result.ckycNumber ?? null, name: result.name ?? null },
    performedById: actor.userId,
  });
}

// ── IFSC (real, free Razorpay public API) ──────────────────────────

export async function runIfscCheck(caseId: string, organizationId: string, input: { ifsc: string }, actor: CheckActor) {
  const kase = await getCase(caseId, organizationId);
  try {
    const result = await lookupIfsc(input.ifsc);
    return await persistCheck({
      caseId: kase.id,
      organizationId,
      checkType: "IFSC",
      source: "IFSC_LOOKUP",
      status: "VERIFIED",
      resultSummary: result as unknown as Prisma.InputJsonValue,
      performedById: actor.userId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "IFSC lookup failed";
    await persistCheck({ caseId: kase.id, organizationId, checkType: "IFSC", source: "IFSC_LOOKUP", status: "FAILED", failureReason: message, performedById: actor.userId });
    throw err;
  }
}

// ── Identity document (Driving License / Passport / Voter ID) ──────

export async function runIdentityDocumentCheck(
  caseId: string,
  organizationId: string,
  input: { documentType: IdentityDocumentType; documentNumber: string; nameToMatch?: string; dob?: string },
  actor: CheckActor
) {
  const kase = await getCase(caseId, organizationId);
  const checkType = input.documentType as VerificationCheckType;
  const provider = getIdentityDocumentProvider();
  try {
    const result = await provider.verify(input);
    return await persistCheck({
      caseId: kase.id,
      organizationId,
      checkType,
      source: "IDENTITY_DOCUMENT_PROVIDER",
      status: result.outcome,
      resultSummary: { registeredName: result.registeredName ?? null, nameMatchScore: result.nameMatchScore ?? null, status: result.status ?? null },
      failureReason: result.failureReason ?? null,
      performedById: actor.userId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Identity document verification failed";
    await persistCheck({ caseId: kase.id, organizationId, checkType, source: "IDENTITY_DOCUMENT_PROVIDER", status: "FAILED", failureReason: message, performedById: actor.userId });
    throw err;
  }
}

// ── Address cross-check (pure, no external call) ────────────────────

export async function runAddressCrossCheck(caseId: string, organizationId: string, sources: AddressSource[], actor: CheckActor) {
  const kase = await getCase(caseId, organizationId);
  const result = crossCheckAddresses(sources);
  const status: TbxVerificationStatus = result.verdict === "MATCH" ? "VERIFIED" : result.verdict === "PARTIAL_MATCH" ? "PENDING" : "FAILED";
  return persistCheck({
    caseId: kase.id,
    organizationId,
    checkType: "ADDRESS",
    source: "ADDRESS_CROSS_CHECK",
    status,
    resultSummary: result as unknown as Prisma.InputJsonValue,
    failureReason: result.verdict === "MISMATCH" ? "Address sources do not sufficiently match" : result.verdict === "INSUFFICIENT_DATA" ? "Fewer than two address sources available to compare" : null,
    performedById: actor.userId,
  });
}

// ── Phone / Email OTP ────────────────────────────────────────────────

async function sendOtp(
  caseId: string,
  organizationId: string,
  checkType: "PHONE" | "EMAIL",
  source: "WHATSAPP_OTP" | "EMAIL_OTP",
  destination: string,
  actor: CheckActor
) {
  const kase = await getCase(caseId, organizationId);
  const { code, challenge } = issueChallenge(destination);
  const dispatch = checkType === "PHONE" ? await dispatchPhoneOtp(destination, code) : await dispatchEmailOtp(destination, code);

  if (!dispatch.success) {
    return persistCheck({
      caseId: kase.id,
      organizationId,
      checkType,
      source,
      status: "FAILED",
      failureReason: dispatch.error ?? "Could not send verification code",
      performedById: actor.userId,
    });
  }

  return persistCheck({
    caseId: kase.id,
    organizationId,
    checkType,
    source,
    status: "PENDING",
    resultSummary: challenge as unknown as Prisma.InputJsonValue,
    performedById: actor.userId,
  });
}

export async function sendPhoneOtp(caseId: string, organizationId: string, input: { phone: string }, actor: CheckActor) {
  return sendOtp(caseId, organizationId, "PHONE", "WHATSAPP_OTP", input.phone, actor);
}

export async function sendEmailOtp(caseId: string, organizationId: string, input: { email: string }, actor: CheckActor) {
  return sendOtp(caseId, organizationId, "EMAIL", "EMAIL_OTP", input.email, actor);
}

export type OtpConfirmOutcome = "VERIFIED" | "EXPIRED" | "EXHAUSTED" | "INCORRECT";

export async function confirmOtp(
  checkId: string,
  caseId: string,
  organizationId: string,
  input: { code: string },
  actor: CheckActor
): Promise<{ check: Awaited<ReturnType<typeof persistCheck>>; result: OtpConfirmOutcome }> {
  await getCase(caseId, organizationId);
  const check = await prisma.verificationCheck.findFirst({ where: { id: checkId, caseId, organizationId, checkType: { in: ["PHONE", "EMAIL"] } } });
  if (!check) throw new workflow.LoanNotFoundError("Verification check not found");
  if (check.status !== "PENDING") throw new workflow.LoanWorkflowError(`This code has already been ${check.status.toLowerCase()}`);

  const challenge = check.resultSummary as unknown as OtpChallenge;
  const result = confirmChallenge(challenge, input.code);

  if (result === "VERIFIED") {
    const updated = await prisma.verificationCheck.update({ where: { id: check.id }, data: { status: "VERIFIED" } });
    await createAuditLog({
      organizationId,
      userId: actor.userId,
      action: "VERIFY",
      entity: "verification.check",
      entityId: check.id,
      description: `${check.checkType} OTP confirmed`,
    });
    return { check: updated, result };
  }
  if (result === "EXPIRED" || result === "EXHAUSTED") {
    const updated = await prisma.verificationCheck.update({
      where: { id: check.id },
      data: { status: "FAILED", failureReason: result === "EXPIRED" ? "Code expired" : "Too many incorrect attempts" },
    });
    await createAuditLog({
      organizationId,
      userId: actor.userId,
      action: "REJECT",
      entity: "verification.check",
      entityId: check.id,
      description: `${check.checkType} OTP confirmation failed: ${result === "EXPIRED" ? "code expired" : "too many incorrect attempts"}`,
    });
    return { check: updated, result };
  }

  // INCORRECT — bump the attempt counter in place, stay PENDING unless this
  // was the last available attempt.
  const nextAttempts = challenge.attempts + 1;
  const exhausted = nextAttempts >= 5;
  const updated = await prisma.verificationCheck.update({
    where: { id: check.id },
    data: exhausted
      ? { status: "FAILED", failureReason: "Too many incorrect attempts", resultSummary: { ...challenge, attempts: nextAttempts } as unknown as Prisma.InputJsonValue }
      : { resultSummary: { ...challenge, attempts: nextAttempts } as unknown as Prisma.InputJsonValue },
  });
  if (exhausted) {
    await createAuditLog({
      organizationId,
      userId: actor.userId,
      action: "REJECT",
      entity: "verification.check",
      entityId: check.id,
      description: `${check.checkType} OTP confirmation failed: too many incorrect attempts`,
    });
  }
  return { check: updated, result: exhausted ? "EXHAUSTED" : "INCORRECT" };
}

// ── Manual checks (Employment / Education / Reference) ──────────────

export async function recordManualCheck(
  caseId: string,
  organizationId: string,
  input: { checkType: "EMPLOYMENT" | "EDUCATION" | "REFERENCE"; outcome: "VERIFIED" | "FAILED"; notes?: string },
  actor: CheckActor
) {
  const kase = await getCase(caseId, organizationId);
  return persistCheck({
    caseId: kase.id,
    organizationId,
    checkType: input.checkType,
    source: "MANUAL",
    status: input.outcome,
    resultSummary: input.notes ? { notes: input.notes } : undefined,
    failureReason: input.outcome === "FAILED" ? input.notes ?? "Marked failed by reviewer" : null,
    performedById: actor.userId,
  });
}

export async function listChecksForCase(caseId: string, organizationId: string) {
  await getCase(caseId, organizationId);
  return prisma.verificationCheck.findMany({ where: { caseId, organizationId }, orderBy: { performedAt: "desc" } });
}
