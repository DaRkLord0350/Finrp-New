// ============================================================
// lib/lending/repayment.ts
// EMI collection — auto-debit mandate registration (NACH / UPI
// AutoPay) plus manual repayment recording. Mirrors the disbursement
// service's initiate/complete shape and lib/tbx/payments/'s
// dispatch+poll pattern.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { LoanRepaymentMethod, Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import * as workflow from "./workflow/service";
import { getLoanPaymentProvider } from "./payments";
import { D, round2 } from "./core/money";
import { enqueueCollectionPoll } from "./queue";

async function getAccount(loanAccountId: string, organizationId: string) {
  const account = await prisma.loanAccount.findFirst({ where: { id: loanAccountId, organizationId } });
  if (!account) throw new workflow.LoanNotFoundError("Loan account not found");
  return account;
}

// ---------------------------------------------------------------------------
// Mandate registration
// ---------------------------------------------------------------------------

export interface RegisterMandateInput {
  mandateType: "NACH" | "UPI_AUTOPAY";
  payerName: string;
  payerAccountNumber?: string;
  payerIfsc?: string;
  payerVpa?: string;
  maxAmountPerDebit: number;
}

export async function registerAutoDebitMandate(
  loanAccountId: string,
  organizationId: string,
  input: RegisterMandateInput,
  actor: { userId: string }
) {
  const account = await getAccount(loanAccountId, organizationId);
  const provider = getLoanPaymentProvider();
  const result = await provider.registerMandate({
    organizationId,
    loanAccountId: account.id,
    mandateType: input.mandateType,
    payerName: input.payerName,
    payerAccountNumber: input.payerAccountNumber,
    payerIfsc: input.payerIfsc,
    payerVpa: input.payerVpa,
    maxAmountPerDebit: input.maxAmountPerDebit,
    startDate: new Date(),
    endDate: account.maturityDate,
  });

  if (result.outcome === "FAILED" || !result.mandateReferenceId) {
    throw new workflow.LoanWorkflowError("Mandate registration was rejected by the payment gateway");
  }

  const updated = await prisma.loanAccount.update({
    where: { id: account.id },
    data: {
      mandateReferenceId: result.mandateReferenceId,
      mandateType: input.mandateType as LoanRepaymentMethod,
      mandateStatus: result.status ?? "PENDING",
    },
  });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "CREATE",
    entity: "loan.account.mandate",
    entityId: account.id,
    description: `Registered ${input.mandateType} auto-debit mandate for loan account ${account.accountNumber}`,
  });
  return updated;
}

export async function cancelAutoDebitMandate(loanAccountId: string, organizationId: string, actor: { userId: string }) {
  const account = await getAccount(loanAccountId, organizationId);
  if (!account.mandateReferenceId) return account;

  const provider = getLoanPaymentProvider();
  await provider.cancelMandate({ organizationId, mandateReferenceId: account.mandateReferenceId });

  const updated = await prisma.loanAccount.update({
    where: { id: account.id },
    data: { mandateStatus: "CANCELLED" },
  });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "UPDATE",
    entity: "loan.account.mandate",
    entityId: account.id,
    description: `Cancelled auto-debit mandate for loan account ${account.accountNumber}`,
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Auto-debit collection for a due EMI
// ---------------------------------------------------------------------------

export async function collectDueEmi(emiScheduleId: string, organizationId: string) {
  const emi = await prisma.eMISchedule.findFirst({
    where: { id: emiScheduleId },
    include: { loanAccount: true },
  });
  if (!emi || emi.loanAccount.organizationId !== organizationId) throw new workflow.LoanNotFoundError("EMI installment not found");
  if (emi.status === "PAID") return emi;
  if (!emi.loanAccount.mandateReferenceId || emi.loanAccount.mandateStatus !== "ACTIVE") {
    throw new workflow.LoanWorkflowError("No active auto-debit mandate on this loan account");
  }

  const outstanding = round2(D(emi.totalDue.toString()).minus(D(emi.totalPaid.toString())));
  const repayment = await prisma.loanRepayment.create({
    data: {
      loanAccountId: emi.loanAccountId,
      emiScheduleId: emi.id,
      organizationId,
      amount: outstanding.toString(),
      paymentDate: new Date(),
      method: emi.loanAccount.mandateType ?? "NACH",
      status: "INITIATED",
    },
  });

  try {
    const provider = getLoanPaymentProvider();
    const result = await provider.collectViaMandate({
      organizationId,
      mandateReferenceId: emi.loanAccount.mandateReferenceId,
      clientReference: repayment.id,
      amount: Number(outstanding),
      dueDate: emi.dueDate,
    });
    if (result.outcome === "FAILED") throw new Error("Payment gateway reported a failed collection");

    // Stays INITIATED — the gateway has only ACCEPTED the request here, not
    // confirmed the debit. Ledger application (principal/interest split,
    // EMI + account update) happens in applyRepayment, called from
    // completeCollection only once fetchPaymentStatus confirms SUCCESS.
    const updated = await prisma.loanRepayment.update({
      where: { id: repayment.id },
      data: { paymentReferenceId: result.paymentReferenceId },
    });
    await enqueueCollectionPoll({ repaymentId: repayment.id, organizationId }).catch(() => {});
    return updated;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.loanRepayment.update({ where: { id: repayment.id }, data: { status: "FAILED", bounceReason: message } });
    throw err;
  }
}

/** Poll a collection's status and, on SUCCESS, apply it to the EMI + account. */
export async function completeCollection(repaymentId: string, organizationId: string) {
  const repayment = await prisma.loanRepayment.findFirst({ where: { id: repaymentId, organizationId } });
  if (!repayment) throw new workflow.LoanNotFoundError("Repayment not found");
  if (repayment.status !== "SUCCESS" && repayment.status !== "INITIATED") return repayment;
  if (!repayment.paymentReferenceId) return repayment;

  const provider = getLoanPaymentProvider();
  const status = await provider.fetchPaymentStatus({ organizationId, paymentReferenceId: repayment.paymentReferenceId });

  if (status.status === "BOUNCED" || status.status === "FAILED") {
    return prisma.loanRepayment.update({
      where: { id: repayment.id },
      data: { status: status.status === "BOUNCED" ? "BOUNCED" : "FAILED", bounceReason: status.failureReason },
    });
  }
  if (status.status !== "SUCCESS") return repayment;

  return applyRepayment(repayment.id, organizationId);
}

// ---------------------------------------------------------------------------
// Manual repayment (cash / bank transfer / cheque) — applied immediately
// ---------------------------------------------------------------------------

export async function recordManualRepayment(
  loanAccountId: string,
  organizationId: string,
  input: { amount: number; method: "MANUAL" | "BANK_TRANSFER" | "CASH" | "CHEQUE"; emiScheduleId?: string },
  actor: { userId: string }
) {
  const account = await getAccount(loanAccountId, organizationId);
  const repayment = await prisma.loanRepayment.create({
    data: {
      loanAccountId: account.id,
      emiScheduleId: input.emiScheduleId,
      organizationId,
      amount: input.amount,
      paymentDate: new Date(),
      method: input.method,
      status: "SUCCESS",
    },
  });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "CREATE",
    entity: "loan.repayment",
    entityId: repayment.id,
    description: `Recorded manual repayment of ₹${input.amount} on loan account ${account.accountNumber}`,
  });
  return applyRepayment(repayment.id, organizationId);
}

/**
 * Applies a SUCCESS repayment to its EMI installment (principal/interest
 * split, oldest-due-first if no specific EMI was targeted) and rolls the
 * LoanAccount's outstanding balance / next-due pointers forward.
 * Idempotent: a repayment whose amount is already reflected is a no-op
 * (guarded by only ever transitioning EMI rows still short of totalDue).
 */
async function applyRepayment(repaymentId: string, organizationId: string) {
  const repayment = await prisma.loanRepayment.findUniqueOrThrow({ where: { id: repaymentId } });
  let remaining = D(repayment.amount.toString());

  await prisma.$transaction(async (tx) => {
    const targetEmis = repayment.emiScheduleId
      ? await tx.eMISchedule.findMany({ where: { id: repayment.emiScheduleId } })
      : await tx.eMISchedule.findMany({
          where: { loanAccountId: repayment.loanAccountId, status: { in: ["UPCOMING", "DUE", "OVERDUE", "PARTIALLY_PAID"] } },
          orderBy: { installmentNumber: "asc" },
        });

    for (const emi of targetEmis) {
      if (remaining.lessThanOrEqualTo(0)) break;
      const due = D(emi.totalDue.toString()).minus(D(emi.totalPaid.toString()));
      if (due.lessThanOrEqualTo(0)) continue;
      const applied = remaining.greaterThanOrEqualTo(due) ? due : remaining;
      remaining = remaining.minus(applied);

      const newTotalPaid = D(emi.totalPaid.toString()).plus(applied);
      const isFullyPaid = newTotalPaid.greaterThanOrEqualTo(D(emi.totalDue.toString()));
      const interestPortion = applied.greaterThan(D(emi.interestDue.toString()).minus(D(emi.interestPaid.toString())))
        ? D(emi.interestDue.toString()).minus(D(emi.interestPaid.toString()))
        : applied;
      const principalPortion = applied.minus(interestPortion);

      await tx.eMISchedule.update({
        where: { id: emi.id },
        data: {
          totalPaid: round2(newTotalPaid).toString(),
          interestPaid: round2(D(emi.interestPaid.toString()).plus(interestPortion)).toString(),
          principalPaid: round2(D(emi.principalPaid.toString()).plus(principalPortion)).toString(),
          status: isFullyPaid ? "PAID" : "PARTIALLY_PAID",
          paidDate: isFullyPaid ? new Date() : undefined,
        },
      });

      if (!repayment.emiScheduleId) {
        await tx.loanRepayment.update({ where: { id: repayment.id }, data: { emiScheduleId: emi.id } });
      }
    }

    const account = await tx.loanAccount.findUniqueOrThrow({ where: { id: repayment.loanAccountId } });
    const newOutstanding = round2(D(account.currentOutstandingPrincipal.toString()).minus(D(repayment.amount.toString())));
    const nextDue = await tx.eMISchedule.findFirst({
      where: { loanAccountId: account.id, status: { in: ["UPCOMING", "DUE", "OVERDUE", "PARTIALLY_PAID"] } },
      orderBy: { installmentNumber: "asc" },
    });

    await tx.loanAccount.update({
      where: { id: account.id },
      data: {
        currentOutstandingPrincipal: (newOutstanding.lessThan(0) ? D(0) : newOutstanding).toString() as unknown as Prisma.Decimal,
        lastPaymentDate: new Date(),
        nextDueDate: nextDue?.dueDate ?? null,
        nextDueAmount: nextDue ? (D(nextDue.totalDue.toString()).minus(D(nextDue.totalPaid.toString())) as unknown as Prisma.Decimal) : null,
        ...(newOutstanding.lessThanOrEqualTo(0) ? { status: "CLOSED" as const, closedAt: new Date(), closureType: "NATURAL" as const } : {}),
      },
    });
  });

  await createAuditLog({
    organizationId,
    action: "POST",
    entity: "loan.repayment",
    entityId: repayment.id,
    description: `Applied repayment of ₹${repayment.amount.toString()} to loan account ${repayment.loanAccountId}`,
  });
  return prisma.loanRepayment.findUniqueOrThrow({ where: { id: repayment.id } });
}

export async function listRepayments(loanAccountId: string, organizationId: string) {
  await getAccount(loanAccountId, organizationId);
  return prisma.loanRepayment.findMany({ where: { loanAccountId, organizationId }, orderBy: { paymentDate: "desc" } });
}

export async function getEmiSchedule(loanAccountId: string, organizationId: string) {
  await getAccount(loanAccountId, organizationId);
  return prisma.eMISchedule.findMany({ where: { loanAccountId }, orderBy: { installmentNumber: "asc" } });
}
