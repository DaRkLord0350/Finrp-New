// ============================================================
// lib/lending/disbursement.ts
// Disburses sanctioned principal to the borrower via
// lib/lending/payments/ (LoanPaymentProvider), then creates the
// LoanAccount + EMISchedule and advances the workflow. Two-step
// initiate/complete, mirroring lib/tbx/payments/payment.service.ts's
// dispatch+poll shape — the payment gateway is asynchronous even
// though the mock provider resolves immediately.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { LoanDisbursementMode, Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import * as workflow from "./workflow/service";
import { getLoanPaymentProvider, LoanPaymentProviderError } from "./payments";
import { generateAmortizationSchedule } from "./core/emi";
import { enqueueDisbursementPoll } from "./queue";

export interface InitiateDisbursementInput {
  bankAccountId: string;
  mode: LoanDisbursementMode;
  beneficiaryAccountNumber: string;
  beneficiaryIfsc: string;
}

export async function initiateDisbursement(
  applicationId: string,
  organizationId: string,
  input: InitiateDisbursementInput,
  actor: workflow.LoanActor
) {
  const app = await prisma.loanApplication.findFirst({
    where: { id: applicationId, organizationId, deletedAt: null },
    include: { customer: true },
  });
  if (!app) throw new workflow.LoanNotFoundError();
  if (app.stage !== "DISBURSEMENT") {
    throw new workflow.LoanWorkflowError(`Cannot disburse an application at stage ${app.stage}`);
  }
  if (!app.approvedAmount) throw new workflow.LoanWorkflowError("Application has no approved amount");

  const bankAccount = await prisma.bankAccount.findFirst({ where: { id: input.bankAccountId, organizationId, deletedAt: null } });
  if (!bankAccount) throw new workflow.LoanNotFoundError("Source bank account not found");

  const disbursement = await prisma.loanDisbursement.create({
    data: {
      applicationId: app.id,
      organizationId,
      amount: app.approvedAmount,
      mode: input.mode,
      bankAccountId: input.bankAccountId,
      status: "PENDING",
      initiatedById: actor.userId,
    },
  });

  try {
    const provider = getLoanPaymentProvider();
    const result = await provider.disburse({
      organizationId,
      clientReference: disbursement.id,
      beneficiaryName: app.customer.name,
      beneficiaryAccountNumber: input.beneficiaryAccountNumber,
      beneficiaryIfsc: input.beneficiaryIfsc,
      amount: Number(app.approvedAmount),
      mode: input.mode,
      narration: `Disbursement for loan application ${app.applicationNumber}`.slice(0, 140),
    });

    if (result.outcome === "FAILED") {
      throw new LoanPaymentProviderError({ message: "Payment gateway reported a failed disbursement", code: "DISBURSE_FAILED" });
    }

    const updated = await prisma.loanDisbursement.update({
      where: { id: disbursement.id },
      data: { status: "PROCESSING", paymentReferenceId: result.paymentReferenceId },
    });
    await createAuditLog({
      organizationId,
      userId: actor.userId,
      action: "CREATE",
      entity: "loan.disbursement",
      entityId: disbursement.id,
      description: `Initiated disbursement of ₹${app.approvedAmount.toString()} for loan application ${app.applicationNumber}`,
    });
    await enqueueDisbursementPoll({ disbursementId: disbursement.id, organizationId, actorId: actor.userId }).catch(() => {});
    return updated;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.loanDisbursement.update({ where: { id: disbursement.id }, data: { status: "FAILED" } });
    await createAuditLog({
      organizationId,
      userId: actor.userId,
      action: "UPDATE",
      entity: "loan.disbursement",
      entityId: disbursement.id,
      description: `Disbursement failed: ${message}`,
    });
    throw err;
  }
}

/**
 * Poll the gateway for a PROCESSING disbursement and, on SUCCESS,
 * create the LoanAccount + EMISchedule and advance the workflow
 * atomically. Idempotent — a disbursement already in a terminal state
 * is a no-op, so a redelivered poll can never double-create an account.
 */
export async function completeDisbursement(disbursementId: string, organizationId: string, actor: workflow.LoanActor) {
  const disbursement = await prisma.loanDisbursement.findFirst({
    where: { id: disbursementId, organizationId },
    include: { application: { include: { product: true } } },
  });
  if (!disbursement) throw new workflow.LoanNotFoundError("Disbursement not found");
  if (disbursement.status === "COMPLETED") return disbursement;
  if (disbursement.status !== "PROCESSING" || !disbursement.paymentReferenceId) return disbursement;

  const provider = getLoanPaymentProvider();
  const status = await provider.fetchPaymentStatus({ organizationId, paymentReferenceId: disbursement.paymentReferenceId });

  if (status.status === "FAILED") {
    await prisma.loanDisbursement.update({ where: { id: disbursement.id }, data: { status: "FAILED" } });
    return disbursement;
  }
  if (status.status !== "SUCCESS") return disbursement; // still processing

  const app = disbursement.application;
  const disbursedAt = new Date();
  const maturityDate = new Date(disbursedAt);
  maturityDate.setMonth(maturityDate.getMonth() + (app.approvedTenureMonths ?? 0));
  const accountNumber = `LN${new Date().getFullYear()}${disbursement.id.slice(-8).toUpperCase()}`;

  const schedule = generateAmortizationSchedule(
    app.approvedAmount!,
    app.interestRateOffered ?? app.product.minInterestRate,
    app.approvedTenureMonths ?? app.requestedTenureMonths,
    app.product.interestRateType === "FLAT" ? "FLAT" : "REDUCING_BALANCE",
    disbursedAt
  );

  await prisma.$transaction(async (tx) => {
    const account = await tx.loanAccount.create({
      data: {
        organizationId,
        applicationId: app.id,
        customerId: app.customerId,
        productId: app.productId,
        accountNumber,
        principalDisbursed: app.approvedAmount!,
        interestRate: app.interestRateOffered ?? app.product.minInterestRate,
        tenureMonths: app.approvedTenureMonths ?? app.requestedTenureMonths,
        disbursedAt,
        maturityDate,
        currentOutstandingPrincipal: app.approvedAmount!,
        status: "ACTIVE",
        nextDueDate: schedule[0]?.dueDate,
        nextDueAmount: schedule[0]?.totalDue as unknown as Prisma.Decimal,
      },
    });

    await tx.eMISchedule.createMany({
      data: schedule.map((row) => ({
        loanAccountId: account.id,
        installmentNumber: row.installmentNumber,
        dueDate: row.dueDate,
        principalDue: row.principalDue as unknown as Prisma.Decimal,
        interestDue: row.interestDue as unknown as Prisma.Decimal,
        totalDue: row.totalDue as unknown as Prisma.Decimal,
        outstandingPrincipal: row.outstandingPrincipal as unknown as Prisma.Decimal,
        status: "UPCOMING" as const,
      })),
    });

    await tx.loanDisbursement.update({
      where: { id: disbursement.id },
      data: { status: "COMPLETED", disbursedAt, loanAccountId: account.id, utrNumber: status.utrNumber },
    });
  });

  await workflow.markDisbursed({ applicationId: app.id, organizationId, actor });
  return prisma.loanDisbursement.findUniqueOrThrow({ where: { id: disbursement.id } });
}

export async function listDisbursements(applicationId: string, organizationId: string) {
  return prisma.loanDisbursement.findMany({ where: { applicationId, organizationId }, orderBy: { createdAt: "desc" } });
}
