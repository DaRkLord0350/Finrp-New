// ============================================================
// lib/lending/applications.ts
// Application CRUD, listing, co-applicants, and the eligibility
// pre-screen — orchestrates lib/lending/workflow/service.ts (the
// state machine) with lib/lending/core/eligibility.ts (the rule
// engine). This file does not itself change stage/status beyond what
// it delegates to the workflow service.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { LoanApplicationStage, LoanApplicationStatus, LoanPartyType, Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import * as workflow from "./workflow/service";
import { evaluateEligibility, type ApplicantFinancialProfile, type EligibilityRuleSet } from "./core/eligibility";
import { getProduct } from "./products";

export interface CreateApplicationInput {
  customerId: string;
  productId: string;
  requestedAmount: number;
  requestedTenureMonths: number;
  purpose?: string;
}

export async function createApplication(
  organizationId: string,
  input: CreateApplicationInput,
  actor: workflow.LoanActor
) {
  const product = await getProduct(input.productId, organizationId);
  if (!product.isActive) throw new workflow.LoanWorkflowError(`Loan product "${product.name}" is not active`);

  const customer = await prisma.customer.findFirst({ where: { id: input.customerId, organizationId, deletedAt: null } });
  if (!customer) throw new workflow.LoanNotFoundError("Customer not found");

  return workflow.createApplication({
    organizationId,
    customerId: input.customerId,
    productId: input.productId,
    requestedAmount: input.requestedAmount,
    requestedTenureMonths: input.requestedTenureMonths,
    purpose: input.purpose,
    actor,
  });
}

export async function updateApplicationTerms(
  applicationId: string,
  organizationId: string,
  input: { requestedAmount?: number; requestedTenureMonths?: number; purpose?: string },
  actor: workflow.LoanActor
) {
  const app = await workflow.getApplication(applicationId, organizationId);
  if (app.status !== "DRAFT") {
    throw new workflow.LoanWorkflowError("Only a DRAFT application's terms can be edited — withdraw and re-apply otherwise");
  }
  const updated = await prisma.loanApplication.update({
    where: { id: app.id },
    data: {
      requestedAmount: input.requestedAmount,
      requestedTenureMonths: input.requestedTenureMonths,
      purpose: input.purpose,
    },
  });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "UPDATE",
    entity: "loan.application",
    entityId: app.id,
    description: `Updated terms for loan application ${app.applicationNumber}`,
  });
  return updated;
}

export interface ListApplicationsFilters {
  status?: LoanApplicationStatus;
  stage?: LoanApplicationStage;
  productId?: string;
  customerId?: string;
  assignedUnderwriterId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listApplications(organizationId: string, filters: ListApplicationsFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = Math.min(filters.pageSize ?? 25, 100);

  const where: Prisma.LoanApplicationWhereInput = {
    organizationId,
    deletedAt: null,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.stage ? { stage: filters.stage } : {}),
    ...(filters.productId ? { productId: filters.productId } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.assignedUnderwriterId ? { assignedUnderwriterId: filters.assignedUnderwriterId } : {}),
    ...(filters.search
      ? {
          OR: [
            { applicationNumber: { contains: filters.search, mode: "insensitive" } },
            { customer: { name: { contains: filters.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.loanApplication.findMany({
      where,
      include: { customer: true, product: true, assignedUnderwriter: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.loanApplication.count({ where }),
  ]);

  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getApplicationDetail(id: string, organizationId: string) {
  const app = await prisma.loanApplication.findFirst({
    where: { id, organizationId, deletedAt: null },
    include: {
      customer: true,
      product: true,
      assignedUnderwriter: true,
      coApplicants: true,
      documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      eligibilityChecks: { orderBy: { checkedAt: "desc" } },
      collaterals: true,
      approvalSteps: { orderBy: { level: "asc" }, include: { decidedBy: true } },
      generatedLetters: { orderBy: { createdAt: "desc" } },
      agreements: { orderBy: { createdAt: "desc" }, include: { signatories: true } },
      underwritingDecisions: { orderBy: { createdAt: "desc" } },
      account: true,
      disbursements: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!app) throw new workflow.LoanNotFoundError();
  return app;
}

// ---------------------------------------------------------------------------
// Co-applicants / guarantors
// ---------------------------------------------------------------------------

export interface AddCoApplicantInput {
  role: LoanPartyType;
  name: string;
  relationship?: string;
  pan?: string;
  email?: string;
  phone?: string;
  incomeMonthly?: number;
  existingCustomerId?: string;
}

export async function addCoApplicant(applicationId: string, organizationId: string, input: AddCoApplicantInput) {
  const app = await workflow.getApplication(applicationId, organizationId);
  return prisma.loanCoApplicant.create({
    data: {
      applicationId: app.id,
      role: input.role,
      name: input.name,
      relationship: input.relationship,
      pan: input.pan,
      email: input.email,
      phone: input.phone,
      incomeMonthly: input.incomeMonthly,
      existingCustomerId: input.existingCustomerId,
    },
  });
}

export async function removeCoApplicant(coApplicantId: string, applicationId: string, organizationId: string) {
  await workflow.getApplication(applicationId, organizationId); // tenant/ownership check
  return prisma.loanCoApplicant.delete({ where: { id: coApplicantId, applicationId } });
}

// ---------------------------------------------------------------------------
// Eligibility pre-screen + submission
// ---------------------------------------------------------------------------

export async function runEligibilityCheck(applicationId: string, organizationId: string, profile: ApplicantFinancialProfile) {
  const app = await prisma.loanApplication.findFirst({
    where: { id: applicationId, organizationId, deletedAt: null },
    include: { product: true, documents: { where: { status: "VERIFIED", deletedAt: null } } },
  });
  if (!app) throw new workflow.LoanNotFoundError();

  const verifiedDocumentTypes = app.documents.map((d) => d.docType);
  const results = evaluateEligibility({
    rules: app.product.eligibilityRules as unknown as EligibilityRuleSet,
    profile: { ...profile, verifiedDocumentTypes },
    requestedAmount: Number(app.requestedAmount),
    requestedTenureMonths: app.requestedTenureMonths,
    productMinAmount: Number(app.product.minAmount),
    productMaxAmount: Number(app.product.maxAmount),
    productMinTenureMonths: app.product.minTenureMonths,
    productMaxTenureMonths: app.product.maxTenureMonths,
  });

  await prisma.$transaction([
    prisma.loanEligibilityCheck.deleteMany({ where: { applicationId: app.id } }),
    prisma.loanEligibilityCheck.createMany({
      data: results.map((r) => ({
        applicationId: app.id,
        ruleName: r.ruleName,
        passed: r.passed,
        expectedValue: r.expectedValue,
        actualValue: r.actualValue,
        message: r.message,
      })),
    }),
  ]);

  return results;
}

export async function submitApplication(
  applicationId: string,
  organizationId: string,
  profile: ApplicantFinancialProfile,
  actor: workflow.LoanActor
) {
  await runEligibilityCheck(applicationId, organizationId, profile);
  return workflow.submitApplication({ applicationId, organizationId, actor });
}
