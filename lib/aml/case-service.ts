// ============================================================
// lib/aml/case-service.ts
// Case management — mirrors lib/lending/collections.ts's case
// lifecycle shape. resolveCase({resolution: CLEARED | FALSE_POSITIVE})
// is what advances a held loan application's AML pipeline stage —
// see lib/aml/service.ts's header comment for why hits don't
// auto-advance.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { AMLCaseActivityType } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import * as workflow from "@/lib/lending/workflow/service";

async function getCase(caseId: string, organizationId: string) {
  const amlCase = await prisma.aMLCase.findFirst({ where: { id: caseId, organizationId } });
  if (!amlCase) throw new workflow.LoanNotFoundError("AML case not found");
  return amlCase;
}

export async function listCases(organizationId: string, filters: { status?: string } = {}) {
  return prisma.aMLCase.findMany({
    where: { organizationId, ...(filters.status ? { status: filters.status as never } : {}) },
    include: { alerts: true, assignedTo: { select: { id: true, name: true } } },
    orderBy: { openedAt: "desc" },
  });
}

export async function getCaseDetail(caseId: string, organizationId: string) {
  const amlCase = await prisma.aMLCase.findFirst({
    where: { id: caseId, organizationId },
    include: { alerts: { orderBy: { createdAt: "desc" } }, activities: { orderBy: { performedAt: "desc" } }, assignedTo: true },
  });
  if (!amlCase) throw new workflow.LoanNotFoundError("AML case not found");
  return amlCase;
}

async function logActivity(caseId: string, activityType: AMLCaseActivityType, notes: string | undefined, performedById: string) {
  await prisma.aMLCaseActivity.create({ data: { caseId, activityType, notes, performedById } });
}

export async function assignCase(caseId: string, organizationId: string, assignedToId: string, actor: { userId: string }) {
  const amlCase = await getCase(caseId, organizationId);
  const updated = await prisma.aMLCase.update({ where: { id: amlCase.id }, data: { status: "UNDER_REVIEW", assignedToId } });
  await logActivity(amlCase.id, "NOTE", `Assigned to user ${assignedToId}`, actor.userId);
  return updated;
}

export async function escalateCase(caseId: string, organizationId: string, notes: string | undefined, actor: { userId: string }) {
  const amlCase = await getCase(caseId, organizationId);
  const updated = await prisma.aMLCase.update({ where: { id: amlCase.id }, data: { status: "ESCALATED" } });
  await logActivity(amlCase.id, "ESCALATION", notes, actor.userId);
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "UPDATE",
    entity: "aml.case",
    entityId: amlCase.id,
    description: `AML case ${amlCase.caseNumber} escalated`,
  });
  return updated;
}

export interface ResolveCaseInput {
  resolution: "CLEARED" | "FALSE_POSITIVE" | "CONFIRMED_SAR";
  resolutionNotes: string;
  sarReferenceNumber?: string;
}

export async function resolveCase(
  caseId: string,
  organizationId: string,
  input: ResolveCaseInput,
  actor: { userId: string; role?: string; canApprove?: boolean }
) {
  if (!actor.canApprove) {
    throw new workflow.LoanWorkflowError("Resolving an AML case requires the aml.approve permission");
  }
  const amlCase = await getCase(caseId, organizationId);
  if (!["OPEN", "UNDER_REVIEW", "ESCALATED"].includes(amlCase.status)) {
    throw new workflow.LoanWorkflowError(`Cannot resolve a case with status ${amlCase.status}`);
  }

  const finalStatus = input.resolution === "CONFIRMED_SAR" ? "CONFIRMED_SAR" : "CLEARED";
  const updated = await prisma.aMLCase.update({
    where: { id: amlCase.id },
    data: {
      status: finalStatus,
      resolution: input.resolution,
      resolutionNotes: input.resolutionNotes,
      closedAt: new Date(),
      sarFiled: input.resolution === "CONFIRMED_SAR",
      sarReferenceNumber: input.sarReferenceNumber,
    },
  });

  await prisma.aMLAlert.updateMany({ where: { caseId: amlCase.id, status: "OPEN" }, data: { status: "REVIEWED", reviewedById: actor.userId, reviewedAt: new Date() } });
  await logActivity(amlCase.id, input.resolution === "CONFIRMED_SAR" ? "SAR_FILED" : "STATUS_CHANGE", input.resolutionNotes, actor.userId);
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "APPROVE",
    entity: "aml.case",
    entityId: amlCase.id,
    description: `AML case ${amlCase.caseNumber} resolved: ${input.resolution}`,
  });

  // Only a clean resolution unblocks the loan's AML pipeline stage — a
  // confirmed SAR should never silently let the application continue.
  if (amlCase.applicationId && (input.resolution === "CLEARED" || input.resolution === "FALSE_POSITIVE")) {
    await workflow.completeAmlScreen({
      applicationId: amlCase.applicationId,
      organizationId,
      actor,
      detail: `AML case ${amlCase.caseNumber} resolved: ${input.resolution}`,
    }).catch((err) => console.warn("[aml] could not advance workflow after case resolution:", (err as Error).message));
  }

  return updated;
}

export async function addCaseNote(caseId: string, organizationId: string, notes: string, actor: { userId: string }) {
  const amlCase = await getCase(caseId, organizationId);
  await logActivity(amlCase.id, "NOTE", notes, actor.userId);
  return getCaseDetail(amlCase.id, organizationId);
}

export async function reviewAlert(alertId: string, organizationId: string, action: "REVIEWED" | "DISMISSED", notes: string | undefined, actor: { userId: string }) {
  const alert = await prisma.aMLAlert.findFirst({ where: { id: alertId, organizationId } });
  if (!alert) throw new workflow.LoanNotFoundError("AML alert not found");
  return prisma.aMLAlert.update({
    where: { id: alert.id },
    data: { status: action, reviewedById: actor.userId, reviewedAt: new Date(), reviewNotes: notes },
  });
}
