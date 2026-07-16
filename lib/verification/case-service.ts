// ============================================================
// lib/verification/case-service.ts
// Case CRUD + lifecycle + document repository. Mirrors lib/aml/
// case-service.ts's shape, simplified: Verification cases don't carry
// AML's SAR/resolution-type axis — status COMPLETED/REJECTED IS the
// resolution. completeCase() is the human-gated action that (like AML's
// resolveCase / Fraud's resolveCase) unblocks the loan application's
// VERIFICATION pipeline stage — a case never auto-completes itself.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { VerificationSubjectType, VerificationCheckType, LoanDocumentStatus } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import * as workflow from "@/lib/lending/workflow/service";

async function generateCaseNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.verificationCase.count({ where: { organizationId } });
  return `VER${year}${String(count + 1).padStart(6, "0")}`;
}

export async function getCase(caseId: string, organizationId: string) {
  const found = await prisma.verificationCase.findFirst({ where: { id: caseId, organizationId } });
  if (!found) throw new workflow.LoanNotFoundError("Verification case not found");
  return found;
}

export interface CreateCaseInput {
  subjectType: VerificationSubjectType;
  subjectId: string;
  subjectName: string;
  applicationId?: string;
}

/** Finds an already-open case for this exact subject, or creates one. Idempotent per subject. */
export async function findOrCreateOpenCase(organizationId: string, input: CreateCaseInput, actor: { userId: string }) {
  const existing = await prisma.verificationCase.findFirst({
    where: {
      organizationId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      status: { in: ["OPEN", "IN_PROGRESS", "ON_HOLD"] },
    },
  });
  if (existing) return existing;

  const created = await prisma.verificationCase.create({
    data: {
      organizationId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      subjectName: input.subjectName,
      applicationId: input.applicationId,
      caseNumber: await generateCaseNumber(organizationId),
      status: "OPEN",
    },
  });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "CREATE",
    entity: "verification.case",
    entityId: created.id,
    description: `Opened verification case ${created.caseNumber} for ${input.subjectName}`,
  });
  return created;
}

export async function listCases(organizationId: string, filters: { status?: string; subjectType?: string; applicationId?: string } = {}) {
  return prisma.verificationCase.findMany({
    where: {
      organizationId,
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.subjectType ? { subjectType: filters.subjectType as never } : {}),
      ...(filters.applicationId ? { applicationId: filters.applicationId } : {}),
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      _count: { select: { checks: true, documents: true } },
    },
    orderBy: { openedAt: "desc" },
  });
}

export async function getCaseDetail(caseId: string, organizationId: string) {
  const found = await prisma.verificationCase.findFirst({
    where: { id: caseId, organizationId },
    include: {
      checks: { orderBy: { performedAt: "desc" } },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      activities: { orderBy: { performedAt: "desc" } },
      assignedTo: { select: { id: true, name: true } },
      application: { select: { id: true, applicationNumber: true } },
    },
  });
  if (!found) throw new workflow.LoanNotFoundError("Verification case not found");
  return found;
}

async function logActivity(
  caseId: string,
  activityType: "NOTE" | "STATUS_CHANGE" | "ESCALATION" | "APPROVAL",
  notes: string | undefined,
  performedById: string
) {
  await prisma.verificationCaseActivity.create({ data: { caseId, activityType, notes, performedById } });
}

/** Flips OPEN → IN_PROGRESS on the first recorded check. No-op otherwise. Called by service.ts's check runners. */
export async function markInProgress(caseId: string) {
  await prisma.verificationCase.updateMany({ where: { id: caseId, status: "OPEN" }, data: { status: "IN_PROGRESS" } });
}

export async function assignCase(caseId: string, organizationId: string, assignedToId: string, actor: { userId: string }) {
  const found = await getCase(caseId, organizationId);
  const updated = await prisma.verificationCase.update({ where: { id: found.id }, data: { assignedToId } });
  await logActivity(found.id, "NOTE", `Assigned to user ${assignedToId}`, actor.userId);
  return updated;
}

export async function holdCase(caseId: string, organizationId: string, notes: string | undefined, actor: { userId: string }) {
  const found = await getCase(caseId, organizationId);
  const updated = await prisma.verificationCase.update({ where: { id: found.id }, data: { status: "ON_HOLD" } });
  await logActivity(found.id, "STATUS_CHANGE", notes, actor.userId);
  return updated;
}

export async function addCaseNote(caseId: string, organizationId: string, notes: string, actor: { userId: string }) {
  const found = await getCase(caseId, organizationId);
  await logActivity(found.id, "NOTE", notes, actor.userId);
  return getCaseDetail(found.id, organizationId);
}

export interface CompleteCaseInput {
  outcome: "COMPLETED" | "REJECTED";
  notes?: string;
}

export async function completeCase(
  caseId: string,
  organizationId: string,
  input: CompleteCaseInput,
  actor: { userId: string; role?: string; canReview?: boolean }
) {
  if (!actor.canReview) {
    throw new workflow.LoanWorkflowError("Completing a verification case requires the verification.review permission");
  }
  const found = await getCase(caseId, organizationId);
  if (!["OPEN", "IN_PROGRESS", "ON_HOLD"].includes(found.status)) {
    throw new workflow.LoanWorkflowError(`Cannot complete a case with status ${found.status}`);
  }

  const updated = await prisma.verificationCase.update({
    where: { id: found.id },
    data: { status: input.outcome, resolutionNotes: input.notes, completedAt: new Date() },
  });
  await logActivity(found.id, "APPROVAL", input.notes ?? `Case ${input.outcome.toLowerCase()}`, actor.userId);
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "APPROVE",
    entity: "verification.case",
    entityId: found.id,
    description: `Verification case ${found.caseNumber} ${input.outcome.toLowerCase()}`,
  });

  // Only a clean completion unblocks the loan's VERIFICATION pipeline
  // stage — a rejection should never silently let the application continue.
  if (found.applicationId && input.outcome === "COMPLETED") {
    await workflow
      .completeVerification({
        applicationId: found.applicationId,
        organizationId,
        actor,
        detail: `Verification case ${found.caseNumber} completed`,
      })
      .catch((err) => console.warn("[verification] could not advance workflow after case completion:", (err as Error).message));
  }

  return updated;
}

// ── Document repository ─────────────────────────────────────────

export interface UploadVerificationDocumentInput {
  docType: VerificationCheckType;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

export async function uploadDocument(caseId: string, organizationId: string, input: UploadVerificationDocumentInput, actor: { userId: string }) {
  const found = await getCase(caseId, organizationId);
  const doc = await prisma.verificationDocument.create({
    data: {
      caseId: found.id,
      organizationId,
      docType: input.docType,
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
      uploadedById: actor.userId,
      status: "PENDING",
    },
  });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "CREATE",
    entity: "verification.document",
    entityId: doc.id,
    description: `Uploaded ${input.docType} for verification case ${found.caseNumber}`,
  });
  return doc;
}

export async function setDocumentStatus(
  documentId: string,
  organizationId: string,
  status: Extract<LoanDocumentStatus, "VERIFIED" | "REJECTED">,
  actor: { userId: string }
) {
  const doc = await prisma.verificationDocument.findFirst({ where: { id: documentId, organizationId, deletedAt: null } });
  if (!doc) throw new workflow.LoanNotFoundError("Verification document not found");
  const updated = await prisma.verificationDocument.update({
    where: { id: doc.id },
    data: { status, verifiedById: actor.userId, verifiedAt: new Date() },
  });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: status === "VERIFIED" ? "VERIFY" : "REJECT",
    entity: "verification.document",
    entityId: doc.id,
    description: `${status === "VERIFIED" ? "Verified" : "Rejected"} ${doc.docType} (${doc.fileName})`,
  });
  return updated;
}
