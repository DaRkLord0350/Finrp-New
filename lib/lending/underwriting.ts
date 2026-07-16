// ============================================================
// lib/lending/underwriting.ts
// Ties the risk engine (core/risk.ts) into the workflow state
// machine: computes + records the risk score (which also generates
// the LoanApprovalStep rows), and persists the underwriter's (or
// AI-assisted) final decision as a LoanUnderwritingDecision.
// ============================================================

import { prisma } from "@/lib/prisma";
import { computeRiskScore, type RiskScoreInputs } from "./core/risk";
import * as workflow from "./workflow/service";

export async function scoreAndAdvanceToApproval(
  applicationId: string,
  organizationId: string,
  extraSignals: Partial<RiskScoreInputs>,
  actor: workflow.LoanActor
) {
  const app = await prisma.loanApplication.findFirst({
    where: { id: applicationId, organizationId, deletedAt: null },
    include: {
      product: true,
      eligibilityChecks: true,
      collaterals: { where: { status: { in: ["VALUED", "LIEN_MARKED"] } } },
    },
  });
  if (!app) throw new workflow.LoanNotFoundError();

  const passCount = app.eligibilityChecks.filter((c) => c.passed).length;
  const eligibilityPassRate = app.eligibilityChecks.length > 0 ? passCount / app.eligibilityChecks.length : 1;
  const collateralValue = app.collaterals.reduce((sum, c) => sum + Number(c.estimatedValue), 0);

  const result = computeRiskScore({
    eligibilityPassRate,
    requestedToMaxAmountRatio: Number(app.requestedAmount) / Number(app.product.maxAmount),
    collateralCoverageRatio: app.product.collateralRequired ? collateralValue / Number(app.requestedAmount) : undefined,
    ...extraSignals,
  });

  await prisma.riskAssessment.create({
    data: {
      organizationId,
      subjectType: "LOAN_APPLICATION",
      subjectId: app.id,
      category: "CREDIT_RISK",
      score: result.score,
      level: result.level,
      factors: result.factors as unknown as object,
      computedBy: "RULE_ENGINE",
    },
  });

  await workflow.recordRiskScore({
    applicationId: app.id,
    organizationId,
    riskScore: result.score,
    riskCategory: result.level,
    actor,
  });

  return result;
}

export async function recordUnderwritingDecision(
  applicationId: string,
  organizationId: string,
  input: {
    decision: "APPROVE" | "REJECT" | "REFER" | "CONDITIONAL_APPROVE";
    reasoning: string;
    conditions?: string[];
    aiGenerated?: boolean;
  },
  actor: { userId: string; role?: string }
) {
  const app = await prisma.loanApplication.findFirst({ where: { id: applicationId, organizationId, deletedAt: null } });
  if (!app) throw new workflow.LoanNotFoundError();

  return prisma.loanUnderwritingDecision.create({
    data: {
      applicationId: app.id,
      organizationId,
      decision: input.decision,
      decidedById: actor.userId,
      decidedByRole: actor.role,
      riskScoreAtDecision: app.riskScore,
      conditions: input.conditions,
      reasoning: input.reasoning,
      aiGenerated: input.aiGenerated ?? false,
    },
  });
}

export async function getRiskHistory(subjectType: "LOAN_APPLICATION" | "LOAN_ACCOUNT", subjectId: string, organizationId: string) {
  return prisma.riskAssessment.findMany({
    where: { organizationId, subjectType, subjectId },
    orderBy: { computedAt: "desc" },
  });
}
