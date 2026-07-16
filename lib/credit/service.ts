// ============================================================
// lib/credit/service.ts
//
// Orchestrates a credit pull: calls the chosen bureau's provider,
// persists CreditReport + CreditScore + CreditTradeline[] +
// CreditEnquiry[] atomically, logs the call (CreditApiLog), records a
// RiskAssessment, and — when the pull was triggered from a loan
// application's CREDIT_BUREAU stage — advances the workflow.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { CreditBureauProvider, Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { getCreditProvider, type Bureau } from "./index";
import { categorizeScore } from "./core/risk-categorization";
import * as workflow from "@/lib/lending/workflow/service";

export interface PullReportInput {
  subjectType: "CUSTOMER" | "CO_APPLICANT" | "ORGANIZATION";
  subjectId: string;
  subjectName: string;
  pan?: string;
  dob?: string;
  mobileNumber?: string;
  address?: string;
  bureau: Bureau;
  pullType: "SOFT" | "HARD";
  applicationId?: string;
}

async function logApiCall(params: {
  organizationId: string;
  reportId?: string;
  provider: CreditBureauProvider;
  endpoint: string;
  success: boolean;
  statusCode?: number;
  durationMs: number;
  errorMessage?: string;
}) {
  try {
    await prisma.creditApiLog.create({
      data: {
        organizationId: params.organizationId,
        reportId: params.reportId,
        provider: params.provider,
        endpoint: params.endpoint,
        httpMethod: "POST",
        statusCode: params.statusCode,
        durationMs: params.durationMs,
        success: params.success,
        errorMessage: params.errorMessage,
      },
    });
  } catch (err) {
    console.warn("[credit] failed to write CreditApiLog:", (err as Error).message);
  }
}

export async function pullCreditReport(
  organizationId: string,
  input: PullReportInput,
  actor: { userId: string; role?: string }
) {
  const report = await prisma.creditReport.create({
    data: {
      organizationId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      applicationId: input.applicationId,
      provider: input.bureau,
      pullType: input.pullType,
      status: "PENDING",
      requestedById: actor.userId,
    },
  });

  const startedAt = Date.now();
  try {
    const provider = getCreditProvider(input.bureau);
    const result = await provider.pullReport({
      organizationId,
      subjectName: input.subjectName,
      pan: input.pan,
      dob: input.dob,
      mobileNumber: input.mobileNumber,
      address: input.address,
      pullType: input.pullType,
      clientReference: report.id,
    });
    const durationMs = Date.now() - startedAt;

    if (result.outcome === "FAILED") {
      await prisma.creditReport.update({
        where: { id: report.id },
        data: { status: "FAILED", failureReason: result.failureReason ?? "Bureau reported a failed pull" },
      });
      await logApiCall({ organizationId, reportId: report.id, provider: input.bureau, endpoint: "pullReport", success: false, durationMs, errorMessage: result.failureReason });
      return prisma.creditReport.findUniqueOrThrow({ where: { id: report.id } });
    }

    await prisma.$transaction(async (tx) => {
      await tx.creditReport.update({
        where: { id: report.id },
        data: { status: "COMPLETED", referenceId: result.referenceId, rawPayload: (result.raw ?? {}) as Prisma.InputJsonValue, pulledAt: new Date() },
      });

      if (result.score !== undefined) {
        await tx.creditScore.create({
          data: {
            reportId: report.id,
            score: result.score,
            scoreModel: result.scoreModel ?? `${input.bureau} Score`,
            scoreDate: result.scoreDate ? new Date(result.scoreDate) : new Date(),
            riskGrade: categorizeScore(result.score),
          },
        });
      }

      if (result.tradelines.length > 0) {
        await tx.creditTradeline.createMany({
          data: result.tradelines.map((t) => ({
            reportId: report.id,
            lenderName: t.lenderName,
            accountType: t.accountType,
            accountNumber: t.accountNumber,
            ownership: t.ownership,
            status: t.status,
            sanctionedAmount: t.sanctionedAmount,
            currentBalance: t.currentBalance,
            overdueAmount: t.overdueAmount,
            dpd: t.dpd,
            openedDate: t.openedDate ? new Date(t.openedDate) : undefined,
            closedDate: t.closedDate ? new Date(t.closedDate) : undefined,
            lastReportedDate: t.lastReportedDate ? new Date(t.lastReportedDate) : undefined,
          })),
        });
      }

      if (result.enquiries.length > 0) {
        await tx.creditEnquiry.createMany({
          data: result.enquiries.map((e) => ({
            reportId: report.id,
            enquiringInstitution: e.enquiringInstitution,
            enquiryPurpose: e.enquiryPurpose,
            enquiryDate: new Date(e.enquiryDate),
            amount: e.amount,
          })),
        });
      }
    });

    await logApiCall({ organizationId, reportId: report.id, provider: input.bureau, endpoint: "pullReport", success: true, durationMs, statusCode: 200 });
    await createAuditLog({
      organizationId,
      userId: actor.userId,
      action: "CREATE",
      entity: "credit.report",
      entityId: report.id,
      description: `Pulled ${input.bureau} ${input.pullType.toLowerCase()} credit report for ${input.subjectName} — score ${result.score ?? "n/a"}`,
    });

    if (result.score !== undefined) {
      await prisma.riskAssessment.create({
        data: {
          organizationId,
          subjectType: input.applicationId ? "LOAN_APPLICATION" : "CUSTOMER",
          subjectId: input.applicationId ?? input.subjectId,
          category: "CREDIT_RISK",
          score: Math.round(((900 - result.score) / (900 - 300)) * 100), // normalize bureau score to 0-100 risk (higher = riskier)
          level: categorizeScore(result.score),
          factors: { source: "credit_bureau", bureau: input.bureau, rawScore: result.score },
          computedBy: "RULE_ENGINE",
        },
      });
    }

    if (input.applicationId) {
      await workflow.completeCreditBureau({
        applicationId: input.applicationId,
        organizationId,
        actor,
        detail: `${input.bureau} ${input.pullType} pull — score ${result.score ?? "n/a"}`,
      });
    }

    return prisma.creditReport.findUniqueOrThrow({
      where: { id: report.id },
      include: { scores: true, tradelines: true, enquiries: true },
    });
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    await prisma.creditReport.update({ where: { id: report.id }, data: { status: "FAILED", failureReason: message } }).catch(() => {});
    await logApiCall({ organizationId, reportId: report.id, provider: input.bureau, endpoint: "pullReport", success: false, durationMs, errorMessage: message });
    throw err;
  }
}

export async function getReport(reportId: string, organizationId: string) {
  const report = await prisma.creditReport.findFirst({
    where: { id: reportId, organizationId },
    include: { scores: { orderBy: { scoreDate: "desc" } }, tradelines: true, enquiries: { orderBy: { enquiryDate: "desc" } } },
  });
  if (!report) throw new workflow.LoanNotFoundError("Credit report not found");
  return report;
}

export async function listReportsForSubject(organizationId: string, subjectType: string, subjectId: string) {
  return prisma.creditReport.findMany({
    where: { organizationId, subjectType: subjectType as never, subjectId },
    include: { scores: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listReports(organizationId: string, filters: { applicationId?: string } = {}) {
  return prisma.creditReport.findMany({
    where: { organizationId, ...(filters.applicationId ? { applicationId: filters.applicationId } : {}) },
    include: { scores: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
