// ============================================================
// lib/financial-statements/service.ts
// Core CRUD service for the Financial Reporting Engine.
// ============================================================

import { prisma } from "@/lib/prisma";
import { computeReport } from "./computation-engine";
import { BUILT_IN_TEMPLATES } from "./schedule3-templates";
import type {
  StatementType,
  StatementStatus,
  AdjEntryInput,
  ExportRequest,
} from "./types";

// ── Seed built-in templates (idempotent) ──────────────────────
export async function seedBuiltInTemplates() {
  for (const tpl of BUILT_IN_TEMPLATES) {
    await prisma.statementTemplate.upsert({
      where: {
        // Use a composite-safe lookup: name + isBuiltIn
        id: `builtin-${tpl.category}-${tpl.statementType}`.toLowerCase(),
      },
      update: { structure: tpl.structure as object },
      create: {
        id: `builtin-${tpl.category}-${tpl.statementType}`.toLowerCase(),
        name: tpl.name,
        category: tpl.category,
        description: tpl.description,
        isBuiltIn: true,
        isDefault: true,
        structure: tpl.structure as object,
        organizationId: null,
      },
    });
  }
}

// ── Get or create default template for an org ─────────────────
export async function getDefaultTemplate(
  statementType: StatementType,
  category: "CORPORATE" | "NON_CORPORATE" = "CORPORATE"
) {
  const builtInId = `builtin-${category}-${statementType}`.toLowerCase();
  const template = await prisma.statementTemplate.findUnique({
    where: { id: builtInId },
  });
  if (template) return template;
  await seedBuiltInTemplates();
  return prisma.statementTemplate.findUniqueOrThrow({ where: { id: builtInId } });
}

// ── List all reports for an org ───────────────────────────────
export async function listReports(
  organizationId: string,
  statementType?: StatementType
) {
  return prisma.financialReport.findMany({
    where: {
      organizationId,
      ...(statementType ? { statementType } : {}),
    },
    include: {
      fiscalYear: { select: { name: true, startDate: true, endDate: true } },
      template: { select: { name: true, category: true } },
    },
    orderBy: { periodEnd: "desc" },
  });
}

// ── Get one report with full relations ────────────────────────
export async function getReport(reportId: string, organizationId: string) {
  return prisma.financialReport.findFirstOrThrow({
    where: { id: reportId, organizationId },
    include: {
      fiscalYear: true,
      template: true,
      versions: { orderBy: { version: "desc" } },
      reportNotes: { orderBy: { noteNumber: "asc" } },
      adjustmentJournals: {
        include: { entries: true },
        orderBy: { createdAt: "desc" },
      },
      exports: { orderBy: { createdAt: "desc" }, take: 5 },
      snapshots: { orderBy: { computedAt: "desc" }, take: 1 },
    },
  });
}

// ── Create a new report ───────────────────────────────────────
export async function createReport(params: {
  organizationId: string;
  statementType: StatementType;
  fiscalYearId: string;
  periodStart: Date;
  periodEnd: Date;
  comparativeStart?: Date;
  comparativeEnd?: Date;
  createdById?: string;
  category?: "CORPORATE" | "NON_CORPORATE";
}) {
  const template = await getDefaultTemplate(params.statementType, params.category);

  const report = await prisma.financialReport.create({
    data: {
      organizationId: params.organizationId,
      statementType: params.statementType,
      fiscalYearId: params.fiscalYearId,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      comparativeStart: params.comparativeStart,
      comparativeEnd: params.comparativeEnd,
      templateId: template.id,
      createdById: params.createdById,
      status: "DRAFT",
    },
  });

  // Auto-create AuditLog entry
  await prisma.auditLog.create({
    data: {
      organizationId: params.organizationId,
      userId: params.createdById,
      action: "CREATE",
      entity: "FinancialReport",
      entityId: report.id,
      description: `Created ${params.statementType} report for period ${params.periodStart.toISOString().slice(0, 10)} to ${params.periodEnd.toISOString().slice(0, 10)}`,
    },
  });

  return report;
}

// ── Update report status ───────────────────────────────────────
export async function updateReportStatus(
  reportId: string,
  organizationId: string,
  status: StatementStatus,
  userId?: string
) {
  const data: Record<string, unknown> = { status };

  if (status === "APPROVED") {
    data.approvedById = userId;
    data.approvedAt = new Date();
  }
  if (status === "REVIEW") {
    data.reviewedById = userId;
    data.reviewedAt = new Date();
  }
  if (status === "LOCKED") {
    data.lockedAt = new Date();
    data.lockedById = userId;
    // Create a version snapshot when locking
    const existing = await prisma.financialReport.findUniqueOrThrow({
      where: { id: reportId },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    const nextVersion = (existing.versions[0]?.version ?? 0) + 1;
    const snapshot = await computeReport(reportId);
    await prisma.financialReportVersion.create({
      data: {
        financialReportId: reportId,
        organizationId,
        version: nextVersion,
        versionLabel: `v${nextVersion} — Locked`,
        snapshot: snapshot as object,
        changedById: userId,
        isLocked: true,
      },
    });
  }

  const report = await prisma.financialReport.update({
    where: { id: reportId },
    data,
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      action: "UPDATE",
      entity: "FinancialReport",
      entityId: reportId,
      description: `Status changed to ${status}`,
    },
  });

  return report;
}

// ── Get/refresh snapshot ───────────────────────────────────────
export async function getOrComputeSnapshot(
  reportId: string,
  organizationId: string,
  forceRefresh = false
) {
  if (!forceRefresh) {
    const cached = await prisma.financialSnapshot.findFirst({
      where: { financialStatementId: reportId, organizationId, isStale: false },
      orderBy: { computedAt: "desc" },
    });
    if (cached) return cached.data;
  }

  const computed = await computeReport(reportId);

  // Mark old snapshots stale
  await prisma.financialSnapshot.updateMany({
    where: { financialStatementId: reportId },
    data: { isStale: true },
  });

  // Store fresh snapshot
  await prisma.financialSnapshot.create({
    data: {
      organizationId,
      financialStatementId: reportId,
      periodStart: new Date(computed.periodStart),
      periodEnd: new Date(computed.periodEnd),
      data: computed as object,
      includesAdjustments: computed.includesAdjustments,
    },
  });

  return computed;
}

// ── Adjustment Journal CRUD ───────────────────────────────────
export async function createAdjustmentJournal(params: {
  organizationId: string;
  reportId: string;
  description: string;
  entryDate: Date;
  source?: string;
  entries: AdjEntryInput[];
  createdById?: string;
}) {
  const journal = await prisma.adjustmentJournal.create({
    data: {
      organizationId: params.organizationId,
      financialStatementId: params.reportId,
      description: params.description,
      entryDate: params.entryDate,
      source: params.source ?? "AUDITOR",
      createdById: params.createdById,
      entries: {
        create: params.entries.map((e, i) => ({
          accountId: e.accountId,
          scheduleKey: e.scheduleKey,
          type: e.type,
          amount: e.amount,
          description: e.description,
          lineOrder: i,
        })),
      },
    },
    include: { entries: true },
  });

  // Mark snapshot stale
  await prisma.financialSnapshot.updateMany({
    where: { financialStatementId: params.reportId },
    data: { isStale: true },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: params.organizationId,
      userId: params.createdById,
      action: "CREATE",
      entity: "AdjustmentJournal",
      entityId: journal.id,
      description: `Adjustment journal created: ${params.description}`,
    },
  });

  return journal;
}

export async function postAdjustmentJournal(
  journalId: string,
  organizationId: string,
  userId?: string
) {
  const journal = await prisma.adjustmentJournal.update({
    where: { id: journalId },
    data: { status: "POSTED", postedById: userId, postedAt: new Date() },
  });
  await prisma.financialSnapshot.updateMany({
    where: { financialStatementId: journal.financialStatementId },
    data: { isStale: true },
  });
  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      action: "UPDATE",
      entity: "AdjustmentJournal",
      entityId: journalId,
      description: "Adjustment journal posted",
    },
  });
  return journal;
}

// ── Statement Notes ───────────────────────────────────────────
export async function upsertNote(params: {
  organizationId: string;
  reportId: string;
  noteNumber: number;
  scheduleKey: string;
  title: string;
  content: object;
  isAiGenerated?: boolean;
}) {
  return prisma.statementNote.upsert({
    where: { financialStatementId_noteNumber: { financialStatementId: params.reportId, noteNumber: params.noteNumber } },
    update: { title: params.title, content: params.content, isAiGenerated: params.isAiGenerated ?? false },
    create: {
      organizationId: params.organizationId,
      financialStatementId: params.reportId,
      noteNumber: params.noteNumber,
      scheduleKey: params.scheduleKey,
      title: params.title,
      content: params.content,
      isAiGenerated: params.isAiGenerated ?? false,
    },
  });
}

// ── Accounting Policies ───────────────────────────────────────
export async function upsertPolicy(params: {
  organizationId: string;
  policyKey: string;
  title: string;
  content: string;
  isAiGenerated?: boolean;
}) {
  return prisma.accountingPolicy.upsert({
    where: { organizationId_policyKey: { organizationId: params.organizationId, policyKey: params.policyKey } },
    update: { title: params.title, content: params.content, isAiGenerated: params.isAiGenerated ?? false },
    create: params,
  });
}

export async function getPolicies(organizationId: string) {
  return prisma.accountingPolicy.findMany({
    where: { organizationId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

// ── Schedule Mapping CRUD ─────────────────────────────────────
export async function saveMapping(params: {
  organizationId: string;
  accountId: string;
  templateId: string;
  scheduleKey: string;
  scheduleName: string;
  source: "AI_AUTO" | "AI_CONFIRMED" | "MANUAL" | "INHERITED";
  confidence?: number;
  aiRationale?: string;
  overriddenBy?: string;
}) {
  return prisma.accountScheduleMap.upsert({
    where: {
      organizationId_accountId_templateId: {
        organizationId: params.organizationId,
        accountId: params.accountId,
        templateId: params.templateId,
      },
    },
    update: {
      scheduleKey: params.scheduleKey,
      scheduleName: params.scheduleName,
      source: params.source,
      confidence: params.confidence ?? 0,
      aiRationale: params.aiRationale,
      overriddenBy: params.overriddenBy,
      overriddenAt: params.overriddenBy ? new Date() : undefined,
      isActive: true,
    },
    create: {
      organizationId: params.organizationId,
      accountId: params.accountId,
      templateId: params.templateId,
      scheduleKey: params.scheduleKey,
      scheduleName: params.scheduleName,
      source: params.source,
      confidence: params.confidence ?? 0,
      aiRationale: params.aiRationale,
      overriddenBy: params.overriddenBy,
    },
  });
}

export async function getMappings(organizationId: string, templateId: string) {
  return prisma.accountScheduleMap.findMany({
    where: { organizationId, templateId, isActive: true },
    include: {
      account: { select: { id: true, code: true, name: true, type: true } },
    },
    orderBy: { scheduleKey: "asc" },
  });
}

// ── Export request ────────────────────────────────────────────
export async function createExportJob(params: ExportRequest & { organizationId: string; userId?: string }) {
  return prisma.statementExport.create({
    data: {
      organizationId: params.organizationId,
      financialStatementId: params.reportId,
      format: params.format,
      status: "PENDING",
      signaturePlaceholder: params.includeSignaturePlaceholder ?? false,
      requestedById: params.userId,
    },
  });
}

// ── Version list ───────────────────────────────────────────────
export async function listVersions(reportId: string, organizationId: string) {
  return prisma.financialReportVersion.findMany({
    where: { financialReportId: reportId, organizationId },
    orderBy: { version: "desc" },
  });
}
