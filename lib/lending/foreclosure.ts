// ============================================================
// lib/lending/foreclosure.ts
// Foreclosure (full early payoff) and part-payment (partial
// prepayment that reduces principal and re-amortizes the remaining
// schedule). Both respect the owning LoanProduct's
// foreclosureAllowed / partPaymentAllowed + charge-percent config.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import * as workflow from "./workflow/service";
import { D, round2 } from "./core/money";
import { calculateForeclosurePayoff, recomputeScheduleAfterPartPayment } from "./core/emi";

async function getAccountWithProduct(loanAccountId: string, organizationId: string) {
  const account = await prisma.loanAccount.findFirst({
    where: { id: loanAccountId, organizationId },
    include: { product: true },
  });
  if (!account) throw new workflow.LoanNotFoundError("Loan account not found");
  return account;
}

// ---------------------------------------------------------------------------
// Foreclosure
// ---------------------------------------------------------------------------

export async function requestForeclosure(loanAccountId: string, organizationId: string, actor: { userId: string }) {
  const account = await getAccountWithProduct(loanAccountId, organizationId);
  if (!account.product.foreclosureAllowed) {
    throw new workflow.LoanWorkflowError(`Product "${account.product.name}" does not allow foreclosure`);
  }
  if (account.status !== "ACTIVE" && !account.status.startsWith("NPA")) {
    throw new workflow.LoanWorkflowError(`Cannot foreclose a loan account with status ${account.status}`);
  }

  const { foreclosureAmount, charges } = calculateForeclosurePayoff(
    account.currentOutstandingPrincipal,
    account.product.foreclosureChargePercent
  );

  const foreclosure = await prisma.loanForeclosure.create({
    data: {
      loanAccountId: account.id,
      organizationId,
      foreclosureAmount: foreclosureAmount.toString(),
      principalOutstanding: account.currentOutstandingPrincipal,
      chargesApplied: charges.toString(),
      status: "REQUESTED",
    },
  });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "CREATE",
    entity: "loan.foreclosure",
    entityId: foreclosure.id,
    description: `Foreclosure requested for loan account ${account.accountNumber} — payoff ₹${foreclosureAmount.toString()}`,
  });
  return foreclosure;
}

export async function approveForeclosure(
  foreclosureId: string,
  organizationId: string,
  input: { waiveCharges?: boolean },
  actor: { userId: string }
) {
  const foreclosure = await prisma.loanForeclosure.findFirst({ where: { id: foreclosureId, organizationId } });
  if (!foreclosure) throw new workflow.LoanNotFoundError("Foreclosure request not found");
  if (foreclosure.status !== "REQUESTED") {
    throw new workflow.LoanWorkflowError(`Cannot approve a foreclosure with status ${foreclosure.status}`);
  }

  const foreclosureAmount = input.waiveCharges
    ? foreclosure.principalOutstanding
    : foreclosure.foreclosureAmount;

  const updated = await prisma.loanForeclosure.update({
    where: { id: foreclosure.id },
    data: {
      status: "APPROVED",
      approvedById: actor.userId,
      waived: input.waiveCharges ?? false,
      chargesApplied: input.waiveCharges ? "0" : foreclosure.chargesApplied,
      foreclosureAmount,
    },
  });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "APPROVE",
    entity: "loan.foreclosure",
    entityId: foreclosure.id,
    description: `Approved foreclosure (${input.waiveCharges ? "charges waived" : "charges applied"})`,
  });
  return updated;
}

export async function completeForeclosure(foreclosureId: string, organizationId: string, actor: { userId: string }) {
  const foreclosure = await prisma.loanForeclosure.findFirst({
    where: { id: foreclosureId, organizationId },
    include: { loanAccount: true },
  });
  if (!foreclosure) throw new workflow.LoanNotFoundError("Foreclosure request not found");
  if (foreclosure.status !== "APPROVED") {
    throw new workflow.LoanWorkflowError(`Cannot complete a foreclosure with status ${foreclosure.status}`);
  }

  await prisma.$transaction([
    prisma.loanRepayment.create({
      data: {
        loanAccountId: foreclosure.loanAccountId,
        organizationId,
        amount: foreclosure.foreclosureAmount,
        paymentDate: new Date(),
        method: "MANUAL",
        status: "SUCCESS",
        principalComponent: foreclosure.principalOutstanding,
        penaltyComponent: foreclosure.chargesApplied,
      },
    }),
    prisma.eMISchedule.updateMany({
      where: { loanAccountId: foreclosure.loanAccountId, status: { in: ["UPCOMING", "DUE", "OVERDUE", "PARTIALLY_PAID"] } },
      data: { status: "WAIVED" },
    }),
    prisma.loanAccount.update({
      where: { id: foreclosure.loanAccountId },
      data: {
        currentOutstandingPrincipal: 0,
        status: "FORECLOSED",
        closedAt: new Date(),
        closureType: "FORECLOSURE",
        nextDueDate: null,
        nextDueAmount: null,
      },
    }),
    prisma.loanForeclosure.update({ where: { id: foreclosure.id }, data: { status: "COMPLETED", completedAt: new Date() } }),
  ]);

  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "CLOSE",
    entity: "loan.account",
    entityId: foreclosure.loanAccountId,
    description: `Loan account ${foreclosure.loanAccount.accountNumber} foreclosed — payoff ₹${foreclosure.foreclosureAmount.toString()}`,
  });
  return prisma.loanForeclosure.findUniqueOrThrow({ where: { id: foreclosure.id } });
}

// ---------------------------------------------------------------------------
// Part payment (partial prepayment, tenure held constant, EMI reduces)
// ---------------------------------------------------------------------------

export async function recordPartPayment(
  loanAccountId: string,
  organizationId: string,
  input: { amount: number },
  actor: { userId: string }
) {
  const account = await getAccountWithProduct(loanAccountId, organizationId);
  if (!account.product.partPaymentAllowed) {
    throw new workflow.LoanWorkflowError(`Product "${account.product.name}" does not allow part payment`);
  }
  if (account.status !== "ACTIVE" && !account.status.startsWith("NPA")) {
    throw new workflow.LoanWorkflowError(`Cannot part-pay a loan account with status ${account.status}`);
  }

  const currentOutstanding = D(account.currentOutstandingPrincipal.toString());
  const amount = D(input.amount);
  if (amount.lessThanOrEqualTo(0) || amount.greaterThanOrEqualTo(currentOutstanding)) {
    throw new workflow.LoanWorkflowError("Part-payment amount must be greater than 0 and less than the outstanding principal (use foreclosure to pay off fully)");
  }

  const charges = round2(amount.times(D(account.product.partPaymentChargePercent.toString())).dividedBy(100));
  const newOutstanding = round2(currentOutstanding.minus(amount));

  const remainingEmis = await prisma.eMISchedule.findMany({
    where: { loanAccountId: account.id, status: { in: ["UPCOMING", "DUE", "OVERDUE", "PARTIALLY_PAID"] } },
    orderBy: { installmentNumber: "asc" },
  });
  const startInstallmentNumber = remainingEmis[0]?.installmentNumber ?? 1;
  const nextDueDate = remainingEmis[0]?.dueDate ?? new Date();

  const newSchedule = recomputeScheduleAfterPartPayment(
    newOutstanding,
    account.interestRate,
    remainingEmis.length,
    account.product.interestRateType === "FLAT" ? "FLAT" : "REDUCING_BALANCE",
    nextDueDate,
    startInstallmentNumber
  );

  await prisma.$transaction(async (tx) => {
    await tx.loanPartPayment.create({
      data: {
        loanAccountId: account.id,
        organizationId,
        amount: amount.toString(),
        chargesApplied: charges.toString(),
        newOutstandingPrincipal: newOutstanding.toString(),
        scheduleRegenerated: true,
      },
    });

    await tx.eMISchedule.deleteMany({ where: { id: { in: remainingEmis.map((e) => e.id) } } });
    await tx.eMISchedule.createMany({
      data: newSchedule.map((row) => ({
        loanAccountId: account.id,
        installmentNumber: row.installmentNumber,
        dueDate: row.dueDate,
        principalDue: row.principalDue.toString(),
        interestDue: row.interestDue.toString(),
        totalDue: row.totalDue.toString(),
        outstandingPrincipal: row.outstandingPrincipal.toString(),
        status: "UPCOMING" as const,
      })),
    });

    await tx.loanAccount.update({
      where: { id: account.id },
      data: {
        currentOutstandingPrincipal: newOutstanding.toString() as unknown as Prisma.Decimal,
        lastPaymentDate: new Date(),
        nextDueDate: newSchedule[0]?.dueDate,
        nextDueAmount: newSchedule[0]?.totalDue.toString() as unknown as Prisma.Decimal,
      },
    });
  });

  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "POST",
    entity: "loan.account",
    entityId: account.id,
    description: `Part payment of ₹${amount.toString()} on loan account ${account.accountNumber} — outstanding now ₹${newOutstanding.toString()}`,
  });

  return { newOutstanding: newOutstanding.toString(), charges: charges.toString(), scheduleLength: newSchedule.length };
}
