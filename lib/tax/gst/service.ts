// ============================================================
// lib/tax/gst/service.ts
//
// Orchestration layer for GST: profiles, validation, and the
// prepare-for-filing flows that wire computation → validation →
// the filing review checkpoint. Used by API routes + the tax worker.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { stateCodeOfGstin, parseGstPeriod } from "../core/period";
import { runValidation } from "../validation/engine";
import type { ValidationOutcome } from "../validation/types";
import type { GstValidationSubject } from "../validation/rules/gst";
import { generateGstr1 } from "./gstr1";
import { computeGstr3b } from "./gstr3b";
import { upsertSubmission, setReady, type FilingActor } from "../filing/service";
import { toNumber } from "../core/money";

// ── Profiles ──────────────────────────────────────────────────
export async function ensureGstProfile(params: {
  organizationId: string;
  gstin: string;
  legalName?: string;
  tradeName?: string;
  regType?: "REGULAR" | "COMPOSITION" | "SEZ" | "SEZ_DEVELOPER" | "UIN" | "UNREGISTERED";
  filingFrequency?: string;
  isPrimary?: boolean;
}) {
  const stateCode = stateCodeOfGstin(params.gstin) ?? "00";
  return prisma.gstReturnProfile.upsert({
    where: { organizationId_gstin: { organizationId: params.organizationId, gstin: params.gstin } },
    create: {
      organizationId: params.organizationId,
      gstin: params.gstin,
      legalName: params.legalName,
      tradeName: params.tradeName,
      stateCode,
      regType: params.regType ?? "REGULAR",
      filingFrequency: params.filingFrequency ?? "MONTHLY",
      isPrimary: params.isPrimary ?? false,
    },
    update: {
      legalName: params.legalName,
      tradeName: params.tradeName,
      regType: params.regType,
      filingFrequency: params.filingFrequency,
      isPrimary: params.isPrimary,
    },
  });
}

export async function listGstProfiles(organizationId: string) {
  return prisma.gstReturnProfile.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
}

export async function getPrimaryGstin(organizationId: string): Promise<string | null> {
  const profile = await prisma.gstReturnProfile.findFirst({
    where: { organizationId, isActive: true, deletedAt: null },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
  return profile?.gstin ?? null;
}

// ── Validation ────────────────────────────────────────────────
export async function buildGstValidationSubject(
  organizationId: string,
  gstin: string,
  period: string
): Promise<GstValidationSubject> {
  const invoices = await prisma.gstInvoice.findMany({
    where: { organizationId, period, direction: "OUTWARD", deletedAt: null },
  });
  return {
    gstin,
    period,
    invoices: invoices.map((inv) => ({
      id: inv.id,
      classification: inv.classification,
      counterpartyGstin: inv.counterpartyGstin,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate.toISOString(),
      placeOfSupply: inv.placeOfSupply,
      taxableValue: toNumber(inv.taxableValue),
      invoiceValue: toNumber(inv.invoiceValue),
      igst: toNumber(inv.igst),
      cgst: toNumber(inv.cgst),
      sgst: toNumber(inv.sgst),
      cess: toNumber(inv.cess),
    })),
  };
}

export async function runGstValidation(params: {
  organizationId: string;
  gstin: string;
  period: string;
  subjectType: string;
  subjectId?: string;
  triggeredById?: string;
}): Promise<ValidationOutcome> {
  const subject = await buildGstValidationSubject(params.organizationId, params.gstin, params.period);
  const fy = parseGstPeriod(params.period).financialYear;
  return runValidation<GstValidationSubject>({
    organizationId: params.organizationId,
    scheme: "GST",
    subjectType: params.subjectType,
    subjectId: params.subjectId,
    period: fy,
    subject,
    triggeredById: params.triggeredById,
  });
}

// ── Prepare GSTR-1 for filing (validate → generate → READY) ───
export async function prepareGstr1(params: {
  organizationId: string;
  gstin: string;
  period: string;
  actor: FilingActor;
}) {
  const validation = await runGstValidation({
    organizationId: params.organizationId,
    gstin: params.gstin,
    period: params.period,
    subjectType: "GSTR1",
    triggeredById: params.actor.userId,
  });

  const { dataset, result } = await generateGstr1(params.organizationId, params.gstin, params.period, params.actor.userId);

  const submission = await upsertSubmission({
    organizationId: params.organizationId,
    scheme: "GST",
    returnType: "GSTR1",
    period: params.period,
    gstin: params.gstin,
    actor: params.actor,
  });

  // Mark READY only when validation has no blocking errors.
  let readySubmission = submission;
  if (!validation.blocked) {
    readySubmission = await setReady({
      submissionId: submission.id,
      organizationId: params.organizationId,
      payload: result.payload as Prisma.InputJsonValue,
      summary: result.summary as Prisma.InputJsonValue,
      validationRunId: validation.runId ?? undefined,
      validationBlocked: false,
      actor: params.actor,
    });
  }

  await prisma.gstr1Dataset.update({ where: { id: dataset.id }, data: { submissionId: submission.id } });

  return { submission: readySubmission, dataset, validation, payload: result.payload };
}

// ── Prepare GSTR-3B for filing (compute → READY) ──────────────
export async function prepareGstr3b(params: {
  organizationId: string;
  gstin: string;
  period: string;
  actor: FilingActor;
}) {
  const { computation, result } = await computeGstr3b(
    params.organizationId,
    params.gstin,
    params.period,
    params.actor.userId
  );

  const submission = await upsertSubmission({
    organizationId: params.organizationId,
    scheme: "GST",
    returnType: "GSTR3B",
    period: params.period,
    gstin: params.gstin,
    actor: params.actor,
  });

  const readySubmission = await setReady({
    submissionId: submission.id,
    organizationId: params.organizationId,
    payload: result.payload as Prisma.InputJsonValue,
    summary: {
      netIgst: result.netPayable.igst,
      netCgst: result.netPayable.cgst,
      netSgst: result.netPayable.sgst,
      netCess: result.netPayable.cess,
    } as Prisma.InputJsonValue,
    validationBlocked: false,
    actor: params.actor,
  });

  await prisma.gstr3bComputation.update({ where: { id: computation.id }, data: { submissionId: submission.id } });

  return { submission: readySubmission, computation, result };
}
