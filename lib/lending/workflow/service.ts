// ============================================================
// lib/lending/workflow/service.ts
//
// The Loan Application STATE MACHINE. Mirrors lib/tax/filing/
// service.ts's shape exactly: no application reaches disbursement
// without passing through every checkpoint below, and every
// transition appends an IMMUTABLE LoanApplicationLog row (event,
// actor, from/to stage+status, payload hash). Logs are never updated
// or deleted.
//
//   Stage:  APPLICATION → DOCUMENT_COLLECTION → VERIFICATION →
//           CREDIT_BUREAU → AML → FRAUD → RISK_SCORE →
//           APPROVAL_MATRIX → SANCTION → AGREEMENT → DISBURSEMENT →
//           REPAYMENT
//
//   Status: DRAFT → IN_PROGRESS → (ON_HOLD) → APPROVED → SANCTIONED →
//           DISBURSED → ACTIVE
//                    └→ REJECTED / WITHDRAWN (terminal, any pre-
//                       disbursement point)
//
// Each pipeline checkpoint (Verification, Credit Bureau, AML, Fraud)
// is completed by its OWN module's service calling the matching
// `complete*` transition here once its own work is done — this file
// owns only the state machine, not the checks themselves.
// ============================================================

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type {
  Prisma,
  LoanApplicationEvent,
  LoanApplicationStage,
  LoanApplicationStatus,
  Role,
} from "@prisma/client";
import { createAuditLog } from "@/lib/audit";

export class LoanWorkflowError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = "LoanWorkflowError";
  }
}

export class LoanNotFoundError extends Error {
  readonly status = 404;
  constructor(message = "Loan application not found") {
    super(message);
    this.name = "LoanNotFoundError";
  }
}

export interface LoanActor {
  userId: string;
  role?: string;
  /** Must be true to decide an approval step — defense-in-depth over route RBAC. */
  canApprove?: boolean;
}

export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload ?? null)).digest("hex");
}

async function appendLog(params: {
  applicationId: string;
  organizationId: string;
  event: LoanApplicationEvent;
  fromStage?: LoanApplicationStage | null;
  toStage?: LoanApplicationStage | null;
  fromStatus?: LoanApplicationStatus | null;
  toStatus?: LoanApplicationStatus | null;
  actor?: LoanActor;
  payloadHash?: string | null;
  detail?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.loanApplicationLog.create({
    data: {
      applicationId: params.applicationId,
      organizationId: params.organizationId,
      event: params.event,
      fromStage: params.fromStage ?? null,
      toStage: params.toStage ?? null,
      fromStatus: params.fromStatus ?? null,
      toStatus: params.toStatus ?? null,
      actorId: params.actor?.userId,
      actorRole: params.actor?.role,
      payloadHash: params.payloadHash ?? null,
      detail: params.detail,
      metadata: params.metadata,
    },
  });
}

function assertStage(current: LoanApplicationStage, allowed: LoanApplicationStage[], action: string) {
  if (!allowed.includes(current)) {
    throw new LoanWorkflowError(`Cannot ${action} an application at stage ${current} (expected ${allowed.join("/")})`);
  }
}

function assertStatus(current: LoanApplicationStatus, allowed: LoanApplicationStatus[], action: string) {
  if (!allowed.includes(current)) {
    throw new LoanWorkflowError(`Cannot ${action} an application with status ${current} (expected ${allowed.join("/")})`);
  }
}

export async function getApplication(id: string, organizationId: string) {
  const app = await prisma.loanApplication.findFirst({
    where: { id, organizationId, deletedAt: null },
  });
  if (!app) throw new LoanNotFoundError();
  return app;
}

// ---------------------------------------------------------------------------
// Application number — LA{year}{6-digit sequence}, collision-safe via
// retry (loan_applications is unique on [organizationId, applicationNumber]).
// ---------------------------------------------------------------------------
async function generateApplicationNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.loanApplication.count({ where: { organizationId } });
  return `LA${year}${String(count + 1).padStart(6, "0")}`;
}

// ── Create the DRAFT application ──────────────────────────────
export async function createApplication(params: {
  organizationId: string;
  customerId: string;
  productId: string;
  requestedAmount: Prisma.Decimal | number;
  requestedTenureMonths: number;
  purpose?: string;
  actor: LoanActor;
}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const applicationNumber = await generateApplicationNumber(params.organizationId);
    try {
      const created = await prisma.loanApplication.create({
        data: {
          organizationId: params.organizationId,
          customerId: params.customerId,
          productId: params.productId,
          applicationNumber,
          requestedAmount: params.requestedAmount,
          requestedTenureMonths: params.requestedTenureMonths,
          purpose: params.purpose,
          stage: "APPLICATION",
          status: "DRAFT",
          createdById: params.actor.userId,
        },
      });
      await appendLog({
        applicationId: created.id,
        organizationId: created.organizationId,
        event: "CREATED",
        toStage: "APPLICATION",
        toStatus: "DRAFT",
        actor: params.actor,
      });
      return created;
    } catch (err) {
      const isUniqueClash = (err as { code?: string }).code === "P2002";
      if (!isUniqueClash || attempt === 2) throw err;
    }
  }
  throw new LoanWorkflowError("Could not allocate an application number — please retry");
}

// ── DRAFT (stage APPLICATION) → IN_PROGRESS (stage DOCUMENT_COLLECTION) ──
export async function submitApplication(params: { applicationId: string; organizationId: string; actor: LoanActor }) {
  const app = await getApplication(params.applicationId, params.organizationId);
  assertStatus(app.status, ["DRAFT"], "submit");
  assertStage(app.stage, ["APPLICATION"], "submit");

  const payloadHash = hashPayload({
    productId: app.productId,
    requestedAmount: app.requestedAmount.toString(),
    requestedTenureMonths: app.requestedTenureMonths,
  });

  const updated = await prisma.loanApplication.update({
    where: { id: app.id },
    data: { status: "IN_PROGRESS", stage: "DOCUMENT_COLLECTION", submittedAt: new Date(), payloadHash },
  });
  await appendLog({
    applicationId: app.id,
    organizationId: app.organizationId,
    event: "SUBMITTED",
    fromStage: "APPLICATION",
    toStage: "DOCUMENT_COLLECTION",
    fromStatus: "DRAFT",
    toStatus: "IN_PROGRESS",
    actor: params.actor,
    payloadHash,
  });
  return updated;
}

// ── DOCUMENT_COLLECTION → VERIFICATION ────────────────────────
export async function completeDocumentCollection(params: { applicationId: string; organizationId: string; actor: LoanActor }) {
  const app = await getApplication(params.applicationId, params.organizationId);
  assertStage(app.stage, ["DOCUMENT_COLLECTION"], "complete document collection for");

  const pendingDocs = await prisma.loanDocument.count({
    where: { applicationId: app.id, status: { in: ["PENDING", "REJECTED"] }, deletedAt: null },
  });
  if (pendingDocs > 0) {
    throw new LoanWorkflowError(`${pendingDocs} document(s) are not yet verified`);
  }

  const updated = await prisma.loanApplication.update({
    where: { id: app.id },
    data: { stage: "VERIFICATION" },
  });
  await appendLog({
    applicationId: app.id,
    organizationId: app.organizationId,
    event: "DOCUMENTS_COMPLETED",
    fromStage: "DOCUMENT_COLLECTION",
    toStage: "VERIFICATION",
    actor: params.actor,
  });
  return updated;
}

// ── VERIFICATION → CREDIT_BUREAU ──────────────────────────────
export async function completeVerification(params: { applicationId: string; organizationId: string; actor: LoanActor; detail?: string }) {
  const app = await getApplication(params.applicationId, params.organizationId);
  assertStage(app.stage, ["VERIFICATION"], "complete verification for");

  const updated = await prisma.loanApplication.update({
    where: { id: app.id },
    data: { stage: "CREDIT_BUREAU" },
  });
  await appendLog({
    applicationId: app.id,
    organizationId: app.organizationId,
    event: "VERIFICATION_COMPLETED",
    fromStage: "VERIFICATION",
    toStage: "CREDIT_BUREAU",
    actor: params.actor,
    detail: params.detail,
  });
  return updated;
}

// ── CREDIT_BUREAU → AML ────────────────────────────────────────
export async function completeCreditBureau(params: { applicationId: string; organizationId: string; actor: LoanActor; detail?: string }) {
  const app = await getApplication(params.applicationId, params.organizationId);
  assertStage(app.stage, ["CREDIT_BUREAU"], "complete credit bureau check for");

  const updated = await prisma.loanApplication.update({
    where: { id: app.id },
    data: { stage: "AML" },
  });
  await appendLog({
    applicationId: app.id,
    organizationId: app.organizationId,
    event: "CREDIT_PULL_COMPLETED",
    fromStage: "CREDIT_BUREAU",
    toStage: "AML",
    actor: params.actor,
    detail: params.detail,
  });
  return updated;
}

// ── AML → FRAUD ─────────────────────────────────────────────────
export async function completeAmlScreen(params: { applicationId: string; organizationId: string; actor: LoanActor; detail?: string }) {
  const app = await getApplication(params.applicationId, params.organizationId);
  assertStage(app.stage, ["AML"], "complete AML screening for");

  const updated = await prisma.loanApplication.update({
    where: { id: app.id },
    data: { stage: "FRAUD" },
  });
  await appendLog({
    applicationId: app.id,
    organizationId: app.organizationId,
    event: "AML_SCREEN_COMPLETED",
    fromStage: "AML",
    toStage: "FRAUD",
    actor: params.actor,
    detail: params.detail,
  });
  return updated;
}

// ── FRAUD → RISK_SCORE ──────────────────────────────────────────
export async function completeFraudCheck(params: { applicationId: string; organizationId: string; actor: LoanActor; detail?: string }) {
  const app = await getApplication(params.applicationId, params.organizationId);
  assertStage(app.stage, ["FRAUD"], "complete fraud check for");

  const updated = await prisma.loanApplication.update({
    where: { id: app.id },
    data: { stage: "RISK_SCORE" },
  });
  await appendLog({
    applicationId: app.id,
    organizationId: app.organizationId,
    event: "FRAUD_CHECK_COMPLETED",
    fromStage: "FRAUD",
    toStage: "RISK_SCORE",
    actor: params.actor,
    detail: params.detail,
  });
  return updated;
}

// ── RISK_SCORE → APPROVAL_MATRIX (also builds the approval steps) ─
async function resolveApprovalMatrixRule(organizationId: string, productId: string, amount: Prisma.Decimal) {
  const rules = await prisma.loanApprovalMatrixRule.findMany({
    where: {
      organizationId,
      isActive: true,
      minAmount: { lte: amount },
      maxAmount: { gte: amount },
      OR: [{ productId }, { productId: null }],
    },
  });
  return rules.find((r) => r.productId === productId) ?? rules.find((r) => r.productId === null) ?? null;
}

export async function recordRiskScore(params: {
  applicationId: string;
  organizationId: string;
  riskScore: number;
  riskCategory: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  actor: LoanActor;
}) {
  const app = await getApplication(params.applicationId, params.organizationId);
  assertStage(app.stage, ["RISK_SCORE"], "record risk score for");

  const rule = await resolveApprovalMatrixRule(app.organizationId, app.productId, app.requestedAmount);
  const levels: { level: number; role: Role }[] = rule
    ? [
        { level: 1, role: rule.level1Role },
        ...(rule.level2Role ? [{ level: 2, role: rule.level2Role }] : []),
        ...(rule.level3Role ? [{ level: 3, role: rule.level3Role }] : []),
      ]
    : [{ level: 1, role: "ADMIN" as Role }]; // no matrix configured — conservative single-level ADMIN sign-off

  const [updated] = await prisma.$transaction([
    prisma.loanApplication.update({
      where: { id: app.id },
      data: { stage: "APPROVAL_MATRIX", status: "IN_PROGRESS", riskScore: params.riskScore, riskCategory: params.riskCategory },
    }),
    prisma.loanApprovalStep.createMany({
      data: levels.map((l) => ({
        applicationId: app.id,
        organizationId: app.organizationId,
        level: l.level,
        approverRole: l.role,
        status: "PENDING" as const,
      })),
    }),
  ]);

  await appendLog({
    applicationId: app.id,
    organizationId: app.organizationId,
    event: "RISK_SCORED",
    fromStage: "RISK_SCORE",
    toStage: "APPROVAL_MATRIX",
    actor: params.actor,
    metadata: { riskScore: params.riskScore, riskCategory: params.riskCategory, approvalLevels: levels.length },
  });
  return updated;
}

// ── APPROVAL_MATRIX: one approver's decision on one level ────────
export async function decideApprovalStep(params: {
  applicationId: string;
  organizationId: string;
  stepId: string;
  decision: "APPROVED" | "REJECTED";
  comments?: string;
  actor: LoanActor;
}) {
  if (!params.actor.canApprove) {
    throw new LoanWorkflowError("Deciding an approval step requires the lending.approve permission");
  }
  const app = await getApplication(params.applicationId, params.organizationId);
  assertStage(app.stage, ["APPROVAL_MATRIX"], "decide an approval step for");

  const step = await prisma.loanApprovalStep.findFirst({
    where: { id: params.stepId, applicationId: app.id, organizationId: app.organizationId },
  });
  if (!step) throw new LoanNotFoundError("Approval step not found");
  if (step.status !== "PENDING") {
    throw new LoanWorkflowError(`Approval step is already ${step.status}`);
  }

  await prisma.loanApprovalStep.update({
    where: { id: step.id },
    data: { status: params.decision, decidedById: params.actor.userId, decidedAt: new Date(), comments: params.comments },
  });
  await appendLog({
    applicationId: app.id,
    organizationId: app.organizationId,
    event: "APPROVAL_STEP_DECIDED",
    actor: params.actor,
    detail: `Level ${step.level} (${step.approverRole}): ${params.decision}${params.comments ? ` — ${params.comments}` : ""}`,
    metadata: { stepId: step.id, level: step.level, decision: params.decision },
  });

  if (params.decision === "REJECTED") {
    const rejected = await prisma.loanApplication.update({
      where: { id: app.id },
      data: { status: "REJECTED", rejectionReason: params.comments ?? `Rejected at approval level ${step.level}` },
    });
    await appendLog({
      applicationId: app.id,
      organizationId: app.organizationId,
      event: "REJECTED",
      fromStatus: "IN_PROGRESS",
      toStatus: "REJECTED",
      actor: params.actor,
      detail: params.comments,
    });
    await createAuditLog({
      organizationId: app.organizationId,
      userId: params.actor.userId,
      action: "REJECT",
      entity: "loan.application",
      entityId: app.id,
      description: `Rejected loan application ${app.applicationNumber} at approval level ${step.level}`,
    });
    return rejected;
  }

  const remainingPending = await prisma.loanApprovalStep.count({
    where: { applicationId: app.id, status: "PENDING" },
  });
  if (remainingPending > 0) {
    return app; // partial approval — still waiting on other levels
  }

  const approved = await prisma.loanApplication.update({
    where: { id: app.id },
    data: { status: "APPROVED", stage: "SANCTION", approvedAmount: app.requestedAmount, approvedTenureMonths: app.requestedTenureMonths },
  });
  await appendLog({
    applicationId: app.id,
    organizationId: app.organizationId,
    event: "APPROVED",
    fromStage: "APPROVAL_MATRIX",
    toStage: "SANCTION",
    fromStatus: "IN_PROGRESS",
    toStatus: "APPROVED",
    actor: params.actor,
  });
  await createAuditLog({
    organizationId: app.organizationId,
    userId: params.actor.userId,
    action: "APPROVE",
    entity: "loan.application",
    entityId: app.id,
    description: `Approved loan application ${app.applicationNumber} — all approval levels cleared`,
  });
  return approved;
}

// ── SANCTION → AGREEMENT ──────────────────────────────────────
export async function markSanctionIssued(params: { applicationId: string; organizationId: string; actor: LoanActor }) {
  const app = await getApplication(params.applicationId, params.organizationId);
  assertStatus(app.status, ["APPROVED"], "issue a sanction letter for");
  assertStage(app.stage, ["SANCTION"], "issue a sanction letter for");

  const updated = await prisma.loanApplication.update({
    where: { id: app.id },
    data: { status: "SANCTIONED", stage: "AGREEMENT", sanctionedAt: new Date() },
  });
  await appendLog({
    applicationId: app.id,
    organizationId: app.organizationId,
    event: "SANCTION_ISSUED",
    fromStage: "SANCTION",
    toStage: "AGREEMENT",
    fromStatus: "APPROVED",
    toStatus: "SANCTIONED",
    actor: params.actor,
  });
  return updated;
}

// ── AGREEMENT → DISBURSEMENT ──────────────────────────────────
export async function markAgreementExecuted(params: { applicationId: string; organizationId: string; actor: LoanActor }) {
  const app = await getApplication(params.applicationId, params.organizationId);
  assertStage(app.stage, ["AGREEMENT"], "mark agreement executed for");

  const updated = await prisma.loanApplication.update({
    where: { id: app.id },
    data: { stage: "DISBURSEMENT" },
  });
  await appendLog({
    applicationId: app.id,
    organizationId: app.organizationId,
    event: "AGREEMENT_SIGNED",
    fromStage: "AGREEMENT",
    toStage: "DISBURSEMENT",
    actor: params.actor,
  });
  return updated;
}

// ── DISBURSEMENT → REPAYMENT (loan account is now live) ───────
// The disbursement service creates the LoanAccount + EMISchedule in
// the same transaction as this call — see lib/lending/disbursement.ts.
// LoanApplicationStage.MONITORING is intentionally never reached by
// this file: it belongs to the Continuous Monitoring module (Phase 3,
// Module 6), which will transition into it once that engine exists —
// landing here prematurely with no monitoring behind it would be a
// placeholder, not a real state.
export async function markDisbursed(params: { applicationId: string; organizationId: string; actor: LoanActor }) {
  const app = await getApplication(params.applicationId, params.organizationId);
  assertStage(app.stage, ["DISBURSEMENT"], "mark disbursed for");

  const updated = await prisma.loanApplication.update({
    where: { id: app.id },
    data: { status: "ACTIVE", stage: "REPAYMENT", disbursedAt: new Date() },
  });
  await appendLog({
    applicationId: app.id,
    organizationId: app.organizationId,
    event: "DISBURSED",
    fromStage: "DISBURSEMENT",
    toStage: "REPAYMENT",
    fromStatus: "SANCTIONED",
    toStatus: "DISBURSED",
    actor: params.actor,
  });
  await appendLog({
    applicationId: app.id,
    organizationId: app.organizationId,
    event: "ACTIVATED",
    fromStatus: "DISBURSED",
    toStatus: "ACTIVE",
    actor: params.actor,
  });
  await createAuditLog({
    organizationId: app.organizationId,
    userId: params.actor.userId,
    action: "POST",
    entity: "loan.application",
    entityId: app.id,
    description: `Disbursed loan application ${app.applicationNumber}`,
  });
  return updated;
}

// ── Reject at any pre-approval checkpoint (manual or auto) ───────
export async function rejectApplication(params: { applicationId: string; organizationId: string; reason: string; actor: LoanActor }) {
  const app = await getApplication(params.applicationId, params.organizationId);
  assertStatus(app.status, ["DRAFT", "IN_PROGRESS", "ON_HOLD"], "reject");

  const updated = await prisma.loanApplication.update({
    where: { id: app.id },
    data: { status: "REJECTED", rejectionReason: params.reason },
  });
  await appendLog({
    applicationId: app.id,
    organizationId: app.organizationId,
    event: "REJECTED",
    fromStatus: app.status,
    toStatus: "REJECTED",
    actor: params.actor,
    detail: params.reason,
  });
  await createAuditLog({
    organizationId: app.organizationId,
    userId: params.actor.userId,
    action: "REJECT",
    entity: "loan.application",
    entityId: app.id,
    description: `Rejected loan application ${app.applicationNumber}: ${params.reason}`,
  });
  return updated;
}

// ── Applicant/lender withdraws before disbursement ────────────
export async function withdrawApplication(params: { applicationId: string; organizationId: string; reason?: string; actor: LoanActor }) {
  const app = await getApplication(params.applicationId, params.organizationId);
  assertStatus(app.status, ["DRAFT", "IN_PROGRESS", "ON_HOLD", "APPROVED", "CONDITIONALLY_APPROVED", "SANCTIONED"], "withdraw");

  const updated = await prisma.loanApplication.update({
    where: { id: app.id },
    data: { status: "WITHDRAWN" },
  });
  await appendLog({
    applicationId: app.id,
    organizationId: app.organizationId,
    event: "WITHDRAWN",
    fromStatus: app.status,
    toStatus: "WITHDRAWN",
    actor: params.actor,
    detail: params.reason,
  });
  return updated;
}

// ── Hold / release ─────────────────────────────────────────────
export async function holdApplication(params: { applicationId: string; organizationId: string; reason: string; actor: LoanActor }) {
  const app = await getApplication(params.applicationId, params.organizationId);
  assertStatus(app.status, ["IN_PROGRESS"], "place on hold");

  const updated = await prisma.loanApplication.update({
    where: { id: app.id },
    data: { status: "ON_HOLD", holdReason: params.reason },
  });
  await appendLog({
    applicationId: app.id,
    organizationId: app.organizationId,
    event: "HOLD_PLACED",
    fromStatus: "IN_PROGRESS",
    toStatus: "ON_HOLD",
    actor: params.actor,
    detail: params.reason,
  });
  return updated;
}

export async function releaseHold(params: { applicationId: string; organizationId: string; actor: LoanActor }) {
  const app = await getApplication(params.applicationId, params.organizationId);
  assertStatus(app.status, ["ON_HOLD"], "release the hold on");

  const updated = await prisma.loanApplication.update({
    where: { id: app.id },
    data: { status: "IN_PROGRESS", holdReason: null },
  });
  await appendLog({
    applicationId: app.id,
    organizationId: app.organizationId,
    event: "HOLD_RELEASED",
    fromStatus: "ON_HOLD",
    toStatus: "IN_PROGRESS",
    actor: params.actor,
  });
  return updated;
}

/** Full, immutable history for an application, oldest first. */
export async function getApplicationHistory(applicationId: string, organizationId: string) {
  return prisma.loanApplicationLog.findMany({
    where: { applicationId, organizationId },
    orderBy: { createdAt: "asc" },
  });
}
