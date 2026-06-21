// ============================================================
// lib/tax/filing/service.ts
//
// The filing review-checkpoint STATE MACHINE. No return reaches the
// government without passing through explicit CA approval.
//
//   DRAFT → READY → PENDING_APPROVAL → APPROVED → SUBMITTED → ACKNOWLEDGED
//                         │                 │
//                         └→ REJECTED       └→ FAILED
//
// Every transition appends an IMMUTABLE TaxFilingLog row (event, actor,
// from/to status, payload hash, provider response). Logs are never
// updated or deleted — the complete filing history is tamper-evident.
// ============================================================

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma, TaxFilingEvent, TaxFilingStatus, TaxScheme } from "@prisma/client";
import { getFilingProvider } from "./factory";
import { taxAudit } from "../core/audit";

export class FilingStateError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = "FilingStateError";
  }
}

export interface FilingActor {
  userId: string;
  role?: string;
  /** Must be true to APPROVE — defense-in-depth over route RBAC. */
  canApprove?: boolean;
}

export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload ?? null)).digest("hex");
}

async function appendLog(params: {
  submissionId: string;
  organizationId: string;
  event: TaxFilingEvent;
  fromStatus?: TaxFilingStatus | null;
  toStatus?: TaxFilingStatus | null;
  actor?: FilingActor;
  payloadHash?: string | null;
  detail?: string;
  providerResponse?: Prisma.InputJsonValue;
}) {
  await prisma.taxFilingLog.create({
    data: {
      submissionId: params.submissionId,
      organizationId: params.organizationId,
      event: params.event,
      fromStatus: params.fromStatus ?? null,
      toStatus: params.toStatus ?? null,
      actorId: params.actor?.userId,
      actorRole: params.actor?.role,
      payloadHash: params.payloadHash ?? null,
      detail: params.detail,
      providerResponse: params.providerResponse,
    },
  });
}

function assertFrom(current: TaxFilingStatus, allowed: TaxFilingStatus[], action: string) {
  if (!allowed.includes(current)) {
    throw new FilingStateError(`Cannot ${action} a filing in status ${current} (expected ${allowed.join("/")})`);
  }
}

async function getSubmission(id: string, organizationId: string) {
  const sub = await prisma.taxFilingSubmission.findFirst({
    where: { id, organizationId, deletedAt: null },
  });
  if (!sub) throw new FilingStateError("Filing submission not found");
  return sub;
}

// ── Create / fetch the DRAFT submission for a return + period ──
export async function upsertSubmission(params: {
  organizationId: string;
  scheme: TaxScheme;
  returnType: string;
  period: string;
  gstin?: string | null;
  dueDate?: Date | null;
  actor: FilingActor;
}) {
  const existing = await prisma.taxFilingSubmission.findFirst({
    where: {
      organizationId: params.organizationId,
      scheme: params.scheme,
      returnType: params.returnType,
      period: params.period,
      gstin: params.gstin ?? null,
      deletedAt: null,
    },
  });
  if (existing) return existing;

  const created = await prisma.taxFilingSubmission.create({
    data: {
      organizationId: params.organizationId,
      scheme: params.scheme,
      returnType: params.returnType,
      period: params.period,
      gstin: params.gstin ?? null,
      dueDate: params.dueDate ?? null,
      status: "DRAFT",
      preparedById: params.actor.userId,
    },
  });
  await appendLog({
    submissionId: created.id,
    organizationId: created.organizationId,
    event: "CREATED",
    toStatus: "DRAFT",
    actor: params.actor,
  });
  return created;
}

// ── DRAFT → READY (payload generated + validation attached) ───
export async function setReady(params: {
  submissionId: string;
  organizationId: string;
  payload: Prisma.InputJsonValue;
  summary?: Prisma.InputJsonValue;
  validationRunId?: string;
  validationBlocked?: boolean;
  actor: FilingActor;
}) {
  const sub = await getSubmission(params.submissionId, params.organizationId);
  assertFrom(sub.status, ["DRAFT", "READY", "REJECTED", "FAILED"], "generate");
  if (params.validationBlocked) {
    throw new FilingStateError("Validation has blocking errors — resolve them before marking the filing ready");
  }
  const payloadHash = hashPayload(params.payload);
  const updated = await prisma.taxFilingSubmission.update({
    where: { id: sub.id },
    data: {
      status: "READY",
      payload: params.payload,
      payloadHash,
      summary: params.summary,
      validationRunId: params.validationRunId,
      errorMessage: null,
    },
  });
  await appendLog({
    submissionId: sub.id,
    organizationId: sub.organizationId,
    event: "GENERATED",
    fromStatus: sub.status,
    toStatus: "READY",
    actor: params.actor,
    payloadHash,
  });
  return updated;
}

// ── READY → PENDING_APPROVAL ──────────────────────────────────
export async function submitForApproval(params: {
  submissionId: string;
  organizationId: string;
  actor: FilingActor;
}) {
  const sub = await getSubmission(params.submissionId, params.organizationId);
  assertFrom(sub.status, ["READY"], "submit for approval");
  const updated = await prisma.taxFilingSubmission.update({
    where: { id: sub.id },
    data: { status: "PENDING_APPROVAL" },
  });
  await appendLog({
    submissionId: sub.id,
    organizationId: sub.organizationId,
    event: "SUBMITTED_FOR_APPROVAL",
    fromStatus: sub.status,
    toStatus: "PENDING_APPROVAL",
    actor: params.actor,
    payloadHash: sub.payloadHash,
  });
  return updated;
}

// ── PENDING_APPROVAL → APPROVED (CA checkpoint) ───────────────
export async function approve(params: {
  submissionId: string;
  organizationId: string;
  actor: FilingActor;
}) {
  if (!params.actor.canApprove) {
    throw new FilingStateError("Approval requires the tax.approve permission");
  }
  const sub = await getSubmission(params.submissionId, params.organizationId);
  assertFrom(sub.status, ["PENDING_APPROVAL"], "approve");
  const updated = await prisma.taxFilingSubmission.update({
    where: { id: sub.id },
    data: { status: "APPROVED", approvedById: params.actor.userId, approvedAt: new Date() },
  });
  await appendLog({
    submissionId: sub.id,
    organizationId: sub.organizationId,
    event: "APPROVED",
    fromStatus: sub.status,
    toStatus: "APPROVED",
    actor: params.actor,
    payloadHash: sub.payloadHash,
  });
  await taxAudit({
    organizationId: sub.organizationId,
    userId: params.actor.userId,
    action: "UPDATE",
    entity: "tax.filing.approval",
    entityId: sub.id,
    description: `Approved ${sub.returnType} for ${sub.period}`,
  });
  return updated;
}

// ── PENDING_APPROVAL → REJECTED ───────────────────────────────
export async function reject(params: {
  submissionId: string;
  organizationId: string;
  reason: string;
  actor: FilingActor;
}) {
  const sub = await getSubmission(params.submissionId, params.organizationId);
  assertFrom(sub.status, ["PENDING_APPROVAL"], "reject");
  const updated = await prisma.taxFilingSubmission.update({
    where: { id: sub.id },
    data: { status: "REJECTED", errorMessage: params.reason },
  });
  await appendLog({
    submissionId: sub.id,
    organizationId: sub.organizationId,
    event: "REJECTED",
    fromStatus: sub.status,
    toStatus: "REJECTED",
    actor: params.actor,
    detail: params.reason,
  });
  return updated;
}

// ── APPROVED → SUBMITTED → ACKNOWLEDGED (push to provider) ────
export async function submitToProvider(params: {
  submissionId: string;
  organizationId: string;
  signature?: string;
  signatureType?: "EVC" | "DSC";
  actor: FilingActor;
}) {
  const sub = await getSubmission(params.submissionId, params.organizationId);
  assertFrom(sub.status, ["APPROVED"], "submit to government");
  if (!sub.gstin) throw new FilingStateError("Filing has no GSTIN");
  if (!sub.payload) throw new FilingStateError("Filing has no generated payload");

  const provider = getFilingProvider();
  try {
    const saveRes = await provider.saveReturn({
      gstin: sub.gstin,
      returnType: sub.returnType,
      period: sub.period,
      payload: sub.payload,
    });
    await appendLog({
      submissionId: sub.id,
      organizationId: sub.organizationId,
      event: "PUSHED_TO_PROVIDER",
      fromStatus: "APPROVED",
      toStatus: "SUBMITTED",
      actor: params.actor,
      payloadHash: sub.payloadHash,
      detail: `Provider ${provider.name} (${provider.isLive ? "LIVE" : "sandbox"}) ref ${saveRes.reference}`,
      providerResponse: saveRes.raw as Prisma.InputJsonValue,
    });

    const fileRes = await provider.fileReturn({
      gstin: sub.gstin,
      returnType: sub.returnType,
      period: sub.period,
      payload: sub.payload,
      signature: params.signature,
      signatureType: params.signatureType,
    });

    const updated = await prisma.taxFilingSubmission.update({
      where: { id: sub.id },
      data: {
        status: "ACKNOWLEDGED",
        providerRef: saveRes.reference,
        arn: fileRes.arn,
        ackNo: fileRes.ackNo,
        submittedById: params.actor.userId,
        submittedAt: new Date(),
        acknowledgedAt: new Date(),
      },
    });
    await appendLog({
      submissionId: sub.id,
      organizationId: sub.organizationId,
      event: "ACKNOWLEDGED",
      fromStatus: "SUBMITTED",
      toStatus: "ACKNOWLEDGED",
      actor: params.actor,
      payloadHash: sub.payloadHash,
      detail: `ARN ${fileRes.arn ?? "—"}`,
      providerResponse: fileRes.raw as Prisma.InputJsonValue,
    });
    await taxAudit({
      organizationId: sub.organizationId,
      userId: params.actor.userId,
      action: "POST",
      entity: "tax.filing",
      entityId: sub.id,
      description: `Filed ${sub.returnType} ${sub.period} — ARN ${fileRes.arn ?? "pending"}`,
    });
    return updated;
  } catch (err) {
    const message = (err as Error).message;
    await prisma.taxFilingSubmission.update({
      where: { id: sub.id },
      data: { status: "FAILED", errorMessage: message },
    });
    await appendLog({
      submissionId: sub.id,
      organizationId: sub.organizationId,
      event: "FAILED",
      fromStatus: "APPROVED",
      toStatus: "FAILED",
      actor: params.actor,
      detail: message,
    });
    throw err;
  }
}

/** Reset a REJECTED / FAILED filing back to DRAFT for rework. */
export async function resetToDraft(params: {
  submissionId: string;
  organizationId: string;
  actor: FilingActor;
}) {
  const sub = await getSubmission(params.submissionId, params.organizationId);
  assertFrom(sub.status, ["REJECTED", "FAILED"], "reset");
  const updated = await prisma.taxFilingSubmission.update({
    where: { id: sub.id },
    data: { status: "DRAFT", approvedById: null, approvedAt: null },
  });
  await appendLog({
    submissionId: sub.id,
    organizationId: sub.organizationId,
    event: "RESET",
    fromStatus: sub.status,
    toStatus: "DRAFT",
    actor: params.actor,
  });
  return updated;
}

/** Full filing history (immutable log) for a submission. */
export async function getFilingHistory(submissionId: string, organizationId: string) {
  return prisma.taxFilingLog.findMany({
    where: { submissionId, organizationId },
    orderBy: { createdAt: "asc" },
  });
}
