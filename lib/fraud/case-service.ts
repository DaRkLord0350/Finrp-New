// ============================================================
// lib/fraud/case-service.ts
// Case management — mirrors lib/aml/case-service.ts's shape exactly.
// resolveCase({resolution: CLEARED | FALSE_POSITIVE}) is what
// advances a held loan application's FRAUD pipeline stage.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { AMLCaseActivityType } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import * as workflow from "@/lib/lending/workflow/service";

async function getCase(caseId: string, organizationId: string) {
  const fraudCase = await prisma.fraudCase.findFirst({ where: { id: caseId, organizationId } });
  if (!fraudCase) throw new workflow.LoanNotFoundError("Fraud case not found");
  return fraudCase;
}

export async function listCases(organizationId: string, filters: { status?: string } = {}) {
  return prisma.fraudCase.findMany({
    where: { organizationId, ...(filters.status ? { status: filters.status as never } : {}) },
    include: { alerts: true, assignedTo: { select: { id: true, name: true } } },
    orderBy: { openedAt: "desc" },
  });
}

export async function getCaseDetail(caseId: string, organizationId: string) {
  const fraudCase = await prisma.fraudCase.findFirst({
    where: { id: caseId, organizationId },
    include: { alerts: { orderBy: { createdAt: "desc" } }, activities: { orderBy: { performedAt: "desc" } }, assignedTo: true },
  });
  if (!fraudCase) throw new workflow.LoanNotFoundError("Fraud case not found");
  return fraudCase;
}

async function logActivity(caseId: string, activityType: AMLCaseActivityType, notes: string | undefined, performedById: string) {
  await prisma.fraudCaseActivity.create({ data: { caseId, activityType, notes, performedById } });
}

export async function assignCase(caseId: string, organizationId: string, assignedToId: string, actor: { userId: string }) {
  const fraudCase = await getCase(caseId, organizationId);
  const updated = await prisma.fraudCase.update({ where: { id: fraudCase.id }, data: { status: "UNDER_REVIEW", assignedToId } });
  await logActivity(fraudCase.id, "NOTE", `Assigned to user ${assignedToId}`, actor.userId);
  return updated;
}

export async function escalateCase(caseId: string, organizationId: string, notes: string | undefined, actor: { userId: string }) {
  const fraudCase = await getCase(caseId, organizationId);
  const updated = await prisma.fraudCase.update({ where: { id: fraudCase.id }, data: { status: "ESCALATED" } });
  await logActivity(fraudCase.id, "ESCALATION", notes, actor.userId);
  return updated;
}

export interface ResolveFraudCaseInput {
  resolution: "CLEARED" | "FALSE_POSITIVE" | "CONFIRMED_FRAUD";
  resolutionNotes: string;
}

export async function resolveCase(caseId: string, organizationId: string, input: ResolveFraudCaseInput, actor: { userId: string; role?: string; canApprove?: boolean }) {
  if (!actor.canApprove) throw new workflow.LoanWorkflowError("Resolving a fraud case requires the fraud.approve permission");
  const fraudCase = await getCase(caseId, organizationId);
  if (!["OPEN", "UNDER_REVIEW", "ESCALATED"].includes(fraudCase.status)) {
    throw new workflow.LoanWorkflowError(`Cannot resolve a case with status ${fraudCase.status}`);
  }

  const finalStatus = input.resolution === "CONFIRMED_FRAUD" ? "CONFIRMED_FRAUD" : "CLEARED";
  const updated = await prisma.fraudCase.update({
    where: { id: fraudCase.id },
    data: { status: finalStatus, resolution: input.resolution, resolutionNotes: input.resolutionNotes, closedAt: new Date() },
  });

  await prisma.fraudAlert.updateMany({ where: { caseId: fraudCase.id, status: "OPEN" }, data: { status: "REVIEWED", reviewedById: actor.userId, reviewedAt: new Date() } });
  await logActivity(fraudCase.id, "STATUS_CHANGE", input.resolutionNotes, actor.userId);
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "APPROVE",
    entity: "fraud.case",
    entityId: fraudCase.id,
    description: `Fraud case ${fraudCase.caseNumber} resolved: ${input.resolution}`,
  });

  if (fraudCase.applicationId && (input.resolution === "CLEARED" || input.resolution === "FALSE_POSITIVE")) {
    await workflow
      .completeFraudCheck({ applicationId: fraudCase.applicationId, organizationId, actor, detail: `Fraud case ${fraudCase.caseNumber} resolved: ${input.resolution}` })
      .catch((err) => console.warn("[fraud] could not advance workflow after case resolution:", (err as Error).message));
  }

  return updated;
}

export async function addCaseNote(caseId: string, organizationId: string, notes: string, actor: { userId: string }) {
  const fraudCase = await getCase(caseId, organizationId);
  await logActivity(fraudCase.id, "NOTE", notes, actor.userId);
  return getCaseDetail(fraudCase.id, organizationId);
}

export async function reviewAlert(alertId: string, organizationId: string, action: "REVIEWED" | "DISMISSED", notes: string | undefined, actor: { userId: string }) {
  const alert = await prisma.fraudAlert.findFirst({ where: { id: alertId, organizationId } });
  if (!alert) throw new workflow.LoanNotFoundError("Fraud alert not found");
  return prisma.fraudAlert.update({ where: { id: alert.id }, data: { status: action, reviewedById: actor.userId, reviewedAt: new Date(), reviewNotes: notes } });
}
