// ============================================================
// lib/monitoring/case-service.ts
// Case CRUD + lifecycle — mirrors lib/aml/case-service.ts's shape.
// Unlike AML/Fraud/Verification, a MonitoringCase is opened
// automatically by raiseAlert() for HIGH/CRITICAL alerts (see
// service.ts), not by an explicit human "open a case" action — this
// layer covers what happens AFTER that: assign, note, escalate,
// resolve.
// ============================================================

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import * as workflow from "@/lib/lending/workflow/service";

async function getCase(caseId: string, organizationId: string) {
  const found = await prisma.monitoringCase.findFirst({ where: { id: caseId, organizationId } });
  if (!found) throw new workflow.LoanNotFoundError("Monitoring case not found");
  return found;
}

export async function listCases(organizationId: string, filters: { status?: string; subjectType?: string } = {}) {
  return prisma.monitoringCase.findMany({
    where: {
      organizationId,
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.subjectType ? { subjectType: filters.subjectType as never } : {}),
    },
    include: { alerts: true, assignedTo: { select: { id: true, name: true } } },
    orderBy: { openedAt: "desc" },
  });
}

export async function getCaseDetail(caseId: string, organizationId: string) {
  const found = await prisma.monitoringCase.findFirst({
    where: { id: caseId, organizationId },
    include: {
      alerts: { orderBy: { triggeredAt: "desc" } },
      activities: { orderBy: { performedAt: "desc" } },
      assignedTo: { select: { id: true, name: true } },
    },
  });
  if (!found) throw new workflow.LoanNotFoundError("Monitoring case not found");
  return found;
}

async function logActivity(caseId: string, activityType: "NOTE" | "STATUS_CHANGE" | "ESCALATION" | "APPROVAL", notes: string | undefined, performedById: string) {
  await prisma.monitoringCaseActivity.create({ data: { caseId, activityType, notes, performedById } });
}

export async function assignCase(caseId: string, organizationId: string, assignedToId: string, actor: { userId: string }) {
  const found = await getCase(caseId, organizationId);
  const updated = await prisma.monitoringCase.update({ where: { id: found.id }, data: { status: "UNDER_REVIEW", assignedToId } });
  await logActivity(found.id, "NOTE", `Assigned to user ${assignedToId}`, actor.userId);
  return updated;
}

export async function escalateCase(caseId: string, organizationId: string, notes: string | undefined, actor: { userId: string }) {
  const found = await getCase(caseId, organizationId);
  const updated = await prisma.monitoringCase.update({ where: { id: found.id }, data: { status: "ESCALATED" } });
  await logActivity(found.id, "ESCALATION", notes, actor.userId);
  await createAuditLog({ organizationId, userId: actor.userId, action: "UPDATE", entity: "monitoring.case", entityId: found.id, description: `Monitoring case ${found.caseNumber} escalated` });
  return updated;
}

export async function addCaseNote(caseId: string, organizationId: string, notes: string, actor: { userId: string }) {
  const found = await getCase(caseId, organizationId);
  await logActivity(found.id, "NOTE", notes, actor.userId);
  return getCaseDetail(found.id, organizationId);
}

export interface ResolveCaseInput {
  resolution: "RESOLVED" | "CLOSED";
  resolutionNotes: string;
}

export async function resolveCase(caseId: string, organizationId: string, input: ResolveCaseInput, actor: { userId: string; canManage?: boolean }) {
  if (!actor.canManage) {
    throw new workflow.LoanWorkflowError("Resolving a monitoring case requires the monitoring.manage permission");
  }
  const found = await getCase(caseId, organizationId);
  if (!["OPEN", "UNDER_REVIEW", "ESCALATED"].includes(found.status)) {
    throw new workflow.LoanWorkflowError(`Cannot resolve a case with status ${found.status}`);
  }

  const updated = await prisma.monitoringCase.update({
    where: { id: found.id },
    data: { status: input.resolution, resolutionNotes: input.resolutionNotes, closedAt: new Date() },
  });
  await prisma.monitoringAlert.updateMany({ where: { caseId: found.id, status: { in: ["OPEN", "ACKNOWLEDGED", "ESCALATED"] } }, data: { status: "RESOLVED", resolvedById: actor.userId, resolvedAt: new Date(), resolutionNotes: input.resolutionNotes } });
  await logActivity(found.id, "APPROVAL", input.resolutionNotes, actor.userId);
  await createAuditLog({ organizationId, userId: actor.userId, action: "APPROVE", entity: "monitoring.case", entityId: found.id, description: `Monitoring case ${found.caseNumber} ${input.resolution.toLowerCase()}: ${input.resolutionNotes}` });
  return updated;
}

// ── Alerts (list + acknowledge/dismiss without a full case) ────────

export async function listAlerts(organizationId: string, filters: { status?: string; severity?: string } = {}) {
  return prisma.monitoringAlert.findMany({
    where: {
      organizationId,
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.severity ? { severity: filters.severity as never } : {}),
    },
    orderBy: { triggeredAt: "desc" },
    take: 200,
  });
}

export async function acknowledgeAlert(alertId: string, organizationId: string, actor: { userId: string }) {
  const alert = await prisma.monitoringAlert.findFirst({ where: { id: alertId, organizationId } });
  if (!alert) throw new workflow.LoanNotFoundError("Monitoring alert not found");
  if (alert.status !== "OPEN") throw new workflow.LoanWorkflowError(`Cannot acknowledge an alert with status ${alert.status}`);
  return prisma.monitoringAlert.update({ where: { id: alert.id }, data: { status: "ACKNOWLEDGED", acknowledgedById: actor.userId, acknowledgedAt: new Date() } });
}

export async function dismissAlert(alertId: string, organizationId: string, notes: string | undefined, actor: { userId: string }) {
  const alert = await prisma.monitoringAlert.findFirst({ where: { id: alertId, organizationId } });
  if (!alert) throw new workflow.LoanNotFoundError("Monitoring alert not found");
  if (!["OPEN", "ACKNOWLEDGED"].includes(alert.status)) throw new workflow.LoanWorkflowError(`Cannot dismiss an alert with status ${alert.status}`);
  return prisma.monitoringAlert.update({ where: { id: alert.id }, data: { status: "FALSE_POSITIVE", resolvedById: actor.userId, resolvedAt: new Date(), resolutionNotes: notes } });
}

// ── Rule configuration ──────────────────────────────────────────────

export async function listRules(organizationId: string) {
  return prisma.monitoringRule.findMany({ where: { organizationId }, orderBy: { ruleType: "asc" } });
}

export interface UpsertRuleInput {
  ruleType: string;
  name: string;
  description?: string;
  enabled: boolean;
  severity: string;
  config: Record<string, number>;
}

export async function upsertRule(organizationId: string, input: UpsertRuleInput, actor: { userId: string }) {
  return prisma.monitoringRule.upsert({
    where: { organizationId_ruleType: { organizationId, ruleType: input.ruleType as never } },
    update: { name: input.name, description: input.description, enabled: input.enabled, severity: input.severity as never, config: input.config },
    create: {
      organizationId,
      ruleType: input.ruleType as never,
      name: input.name,
      description: input.description,
      enabled: input.enabled,
      severity: input.severity as never,
      config: input.config,
      createdById: actor.userId,
    },
  });
}
