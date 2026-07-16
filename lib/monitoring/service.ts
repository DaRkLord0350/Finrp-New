// ============================================================
// lib/monitoring/service.ts
//
// The alert engine: raiseAlert() is the single write path every
// evaluator (and the AML/Fraud fan-out hooks) funnels through — it
// creates the MonitoringAlert row, notifies org admins/managers via
// the existing generic Notification model, and escalates HIGH/
// CRITICAL alerts into a MonitoringCase automatically (unlike AML/
// Fraud/Verification, which require an explicit human action to open
// a case — Monitoring alerts are system-detected in the first place,
// so auto-opening a case for the serious ones is the escalation step,
// not a substitute for human review of it).
//
// Evaluators query already-existing data (BankTransaction/BankAccount
// for transaction rules, CreditScore for score-drop, LoanRepayment/
// LoanAccount for bounce/default) and are meant to be called once per
// organization per day by the Inngest sweep (inngest/functions/
// monitoring.ts), mirroring lib/lending's daily-sweep window pattern
// (scan "yesterday", not a rolling lookback) rather than needing a
// separate persisted checkpoint.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { MonitoringRuleType, MonitoringSubjectType, MonitoringAlertSeverity, RiskLevel, Prisma } from "@prisma/client";
import { getRuleConfig } from "./rules/defaults";
import { detectHighCashTransactions, detectLargeTransactions, isDormantAccount } from "./rules/transaction";

async function getEffectiveRule(organizationId: string, ruleType: MonitoringRuleType) {
  const rule = await prisma.monitoringRule.findUnique({ where: { organizationId_ruleType: { organizationId, ruleType } } });
  if (rule && !rule.enabled) return null;
  return {
    ruleId: rule?.id ?? null,
    severity: rule?.severity ?? ("MEDIUM" as MonitoringAlertSeverity),
    config: getRuleConfig(ruleType, (rule?.config as Record<string, unknown> | undefined) ?? undefined),
  };
}

async function generateCaseNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.monitoringCase.count({ where: { organizationId } });
  return `MON${year}${String(count + 1).padStart(6, "0")}`;
}

async function openOrAttachCase(
  organizationId: string,
  alertId: string,
  input: { subjectType: MonitoringSubjectType; subjectId: string; subjectLabel: string }
) {
  let kase = await prisma.monitoringCase.findFirst({
    where: { organizationId, subjectType: input.subjectType, subjectId: input.subjectId, status: { in: ["OPEN", "UNDER_REVIEW", "ESCALATED"] } },
  });
  if (!kase) {
    kase = await prisma.monitoringCase.create({
      data: {
        organizationId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        subjectLabel: input.subjectLabel,
        caseNumber: await generateCaseNumber(organizationId),
        status: "OPEN",
      },
    });
  }
  await prisma.monitoringAlert.update({ where: { id: alertId }, data: { caseId: kase.id } });
  return kase;
}

export interface RaiseAlertInput {
  ruleId?: string | null;
  ruleType: MonitoringRuleType;
  subjectType: MonitoringSubjectType;
  subjectId: string;
  subjectLabel: string;
  severity: MonitoringAlertSeverity;
  title: string;
  details: Record<string, unknown>;
}

export async function raiseAlert(organizationId: string, input: RaiseAlertInput) {
  const alert = await prisma.monitoringAlert.create({
    data: {
      organizationId,
      ruleId: input.ruleId ?? undefined,
      ruleType: input.ruleType,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      subjectLabel: input.subjectLabel,
      severity: input.severity,
      title: input.title,
      details: input.details as Prisma.InputJsonValue,
    },
  });

  const recipients = await prisma.user.findMany({
    where: { organizationId, role: { in: ["OWNER", "ADMIN", "MANAGER"] }, isActive: true },
    select: { id: true },
  });
  if (recipients.length) {
    await prisma.notification.createMany({
      data: recipients.map((r) => ({
        organizationId,
        userId: r.id,
        type: "MONITORING_ALERT" as const,
        title: input.title,
        message: `${input.severity} alert on ${input.subjectType.replace(/_/g, " ").toLowerCase()} ${input.subjectLabel}`,
        referenceId: alert.id,
        referenceType: "monitoring_alert",
      })),
    });
  }

  if (input.severity === "HIGH" || input.severity === "CRITICAL") {
    await openOrAttachCase(organizationId, alert.id, input);
  }

  return alert;
}

// ── Transaction monitoring (BankAccount / BankTransaction) ─────────

export async function evaluateTransactionRules(organizationId: string, windowStart: Date, windowEnd: Date) {
  let alertsRaised = 0;
  const [highCash, largeTxn, dormant] = await Promise.all([
    getEffectiveRule(organizationId, "HIGH_CASH_TRANSACTION"),
    getEffectiveRule(organizationId, "LARGE_TRANSACTION"),
    getEffectiveRule(organizationId, "DORMANT_ACCOUNT"),
  ]);

  if (highCash || largeTxn) {
    const rows = await prisma.bankTransaction.findMany({
      where: { organizationId, transactionDate: { gte: windowStart, lt: windowEnd } },
      select: { id: true, txnType: true, credit: true, debit: true, transactionDate: true, bankAccountId: true, bankAccount: { select: { accountName: true } } },
    });
    const txns = rows.map((t) => ({
      id: t.id,
      amount: Number(t.credit ?? t.debit ?? 0),
      txnType: t.txnType,
      transactionDate: t.transactionDate.toISOString(),
    }));
    // TxnLike is deliberately minimal (pure, unit-testable) — the bank
    // account this row belongs to is looked up separately by id rather
    // than smuggled through the detector's generic input/output type.
    const accountOf = new Map(rows.map((t) => [t.id, { bankAccountId: t.bankAccountId, accountName: t.bankAccount.accountName }]));

    if (highCash) {
      for (const hit of detectHighCashTransactions(txns, highCash.config.amountThreshold)) {
        const account = accountOf.get(hit.id)!;
        await raiseAlert(organizationId, {
          ruleId: highCash.ruleId,
          ruleType: "HIGH_CASH_TRANSACTION",
          subjectType: "BANK_ACCOUNT",
          subjectId: account.bankAccountId,
          subjectLabel: account.accountName,
          severity: highCash.severity,
          title: `High cash transaction — ₹${hit.amount.toLocaleString("en-IN")}`,
          details: { ...hit, ...account },
        });
        alertsRaised++;
      }
    }
    if (largeTxn) {
      for (const hit of detectLargeTransactions(txns, largeTxn.config.amountThreshold)) {
        const account = accountOf.get(hit.id)!;
        await raiseAlert(organizationId, {
          ruleId: largeTxn.ruleId,
          ruleType: "LARGE_TRANSACTION",
          subjectType: "BANK_ACCOUNT",
          subjectId: account.bankAccountId,
          subjectLabel: account.accountName,
          severity: largeTxn.severity,
          title: `Large transaction — ₹${hit.amount.toLocaleString("en-IN")}`,
          details: { ...hit, ...account },
        });
        alertsRaised++;
      }
    }
  }

  if (dormant) {
    const accounts = await prisma.bankAccount.findMany({
      where: { organizationId, isActive: true, deletedAt: null },
      select: { id: true, accountName: true, createdAt: true, bankTransactions: { orderBy: { transactionDate: "desc" }, take: 1, select: { transactionDate: true } } },
    });
    for (const acc of accounts) {
      const lastTxn = acc.bankTransactions[0]?.transactionDate ?? null;
      if (isDormantAccount(lastTxn, acc.createdAt, dormant.config.dormancyDays, windowEnd)) {
        await raiseAlert(organizationId, {
          ruleId: dormant.ruleId,
          ruleType: "DORMANT_ACCOUNT",
          subjectType: "BANK_ACCOUNT",
          subjectId: acc.id,
          subjectLabel: acc.accountName,
          severity: dormant.severity,
          title: `Dormant account — no activity in ${dormant.config.dormancyDays}+ days`,
          details: { lastTransactionDate: lastTxn },
        });
        alertsRaised++;
      }
    }
  }

  return alertsRaised;
}

// ── Repayment / loan monitoring (LoanRepayment / LoanAccount) ──────

export async function evaluateRepaymentRules(organizationId: string, windowStart: Date) {
  let alertsRaised = 0;
  const [overdueRule, bounceRule, defaultRule] = await Promise.all([
    getEffectiveRule(organizationId, "REPAYMENT_OVERDUE"),
    getEffectiveRule(organizationId, "BOUNCE_DETECTION"),
    getEffectiveRule(organizationId, "LOAN_DEFAULT"),
  ]);

  if (overdueRule) {
    const overdue = await prisma.eMISchedule.findMany({
      where: { status: "OVERDUE", updatedAt: { gte: windowStart }, loanAccount: { organizationId } },
      select: { id: true, totalDue: true, dueDate: true, loanAccountId: true, loanAccount: { select: { accountNumber: true } } },
    });
    for (const emi of overdue) {
      await raiseAlert(organizationId, {
        ruleId: overdueRule.ruleId,
        ruleType: "REPAYMENT_OVERDUE",
        subjectType: "LOAN_ACCOUNT",
        subjectId: emi.loanAccountId,
        subjectLabel: emi.loanAccount.accountNumber,
        severity: overdueRule.severity,
        title: `EMI overdue — ₹${Number(emi.totalDue).toLocaleString("en-IN")} due ${emi.dueDate.toLocaleDateString("en-IN")}`,
        details: { emiScheduleId: emi.id, totalDue: emi.totalDue.toString(), dueDate: emi.dueDate },
      });
      alertsRaised++;
    }
  }

  if (bounceRule) {
    const bounced = await prisma.loanRepayment.findMany({
      where: { organizationId, status: "BOUNCED", updatedAt: { gte: windowStart } },
      select: { id: true, amount: true, bounceReason: true, loanAccountId: true, loanAccount: { select: { accountNumber: true } } },
    });
    for (const b of bounced) {
      await raiseAlert(organizationId, {
        ruleId: bounceRule.ruleId,
        ruleType: "BOUNCE_DETECTION",
        subjectType: "LOAN_ACCOUNT",
        subjectId: b.loanAccountId,
        subjectLabel: b.loanAccount.accountNumber,
        severity: bounceRule.severity,
        title: `EMI payment bounced — ₹${Number(b.amount).toLocaleString("en-IN")}`,
        details: { repaymentId: b.id, bounceReason: b.bounceReason },
      });
      alertsRaised++;
    }
  }

  if (defaultRule) {
    const flagged = await prisma.loanAccount.findMany({
      where: { organizationId, status: { in: ["NPA_SUBSTANDARD", "NPA_DOUBTFUL", "NPA_LOSS", "DEFAULTED"] }, npaFlaggedAt: { gte: windowStart } },
      select: { id: true, accountNumber: true, status: true, npaDays: true, currentOutstandingPrincipal: true },
    });
    for (const acc of flagged) {
      await raiseAlert(organizationId, {
        ruleId: defaultRule.ruleId,
        ruleType: "LOAN_DEFAULT",
        subjectType: "LOAN_ACCOUNT",
        subjectId: acc.id,
        subjectLabel: acc.accountNumber,
        severity: defaultRule.severity,
        title: `Loan account newly flagged ${acc.status.replace(/_/g, " ")}`,
        details: { status: acc.status, npaDays: acc.npaDays, outstandingPrincipal: acc.currentOutstandingPrincipal.toString() },
      });
      alertsRaised++;
    }
  }

  return alertsRaised;
}

// ── Credit score monitoring (CreditScore, Module 2) ─────────────────

export async function evaluateCreditScoreDrop(organizationId: string, subjectType: string, subjectId: string) {
  const rule = await getEffectiveRule(organizationId, "CREDIT_SCORE_DROP");
  if (!rule) return false;

  const reports = await prisma.creditReport.findMany({
    where: { organizationId, subjectType: subjectType as never, subjectId, status: "COMPLETED" },
    orderBy: { pulledAt: "desc" },
    take: 2,
    include: { scores: { orderBy: { scoreDate: "desc" }, take: 1 } },
  });
  const scores = reports.map((r) => r.scores[0]).filter((s): s is NonNullable<typeof s> => Boolean(s));
  if (scores.length < 2) return false;

  const drop = scores[1].score - scores[0].score;
  if (drop < rule.config.dropThreshold) return false;

  const subjectLabel =
    reports[0].subjectType === "CUSTOMER"
      ? ((await prisma.customer.findUnique({ where: { id: subjectId }, select: { name: true } }))?.name ?? subjectId)
      : subjectId;

  await raiseAlert(organizationId, {
    ruleId: rule.ruleId,
    ruleType: "CREDIT_SCORE_DROP",
    subjectType: "CUSTOMER",
    subjectId,
    subjectLabel,
    severity: rule.severity,
    title: `Credit score dropped ${drop} points`,
    details: { previousScore: scores[1].score, currentScore: scores[0].score, drop },
  });
  return true;
}

// ── AML / Fraud fan-out — thin additive hooks called from lib/aml/  ─
// service.ts and lib/fraud/service.ts right after a NEW case opens.
// Never throws into the caller: wrapped in .catch() at the call site,
// same convention as workflow.completeAmlScreen()'s cross-module calls.

function riskLevelToSeverity(level: RiskLevel): MonitoringAlertSeverity {
  return level;
}

export async function raiseAmlCaseAlert(organizationId: string, amlCase: { id: string; caseNumber: string; subjectName: string; riskRating: RiskLevel }) {
  const rule = await getEffectiveRule(organizationId, "AML_CASE_OPENED");
  if (!rule) return null;
  return raiseAlert(organizationId, {
    ruleId: rule.ruleId,
    ruleType: "AML_CASE_OPENED",
    subjectType: "AML_CASE",
    subjectId: amlCase.id,
    subjectLabel: amlCase.subjectName,
    severity: riskLevelToSeverity(amlCase.riskRating),
    title: `AML case ${amlCase.caseNumber} opened`,
    details: { caseNumber: amlCase.caseNumber, riskRating: amlCase.riskRating },
  });
}

export async function raiseFraudCaseAlert(organizationId: string, fraudCase: { id: string; caseNumber: string; subjectName: string; riskRating: RiskLevel }) {
  const rule = await getEffectiveRule(organizationId, "FRAUD_CASE_OPENED");
  if (!rule) return null;
  return raiseAlert(organizationId, {
    ruleId: rule.ruleId,
    ruleType: "FRAUD_CASE_OPENED",
    subjectType: "FRAUD_CASE",
    subjectId: fraudCase.id,
    subjectLabel: fraudCase.subjectName,
    severity: riskLevelToSeverity(fraudCase.riskRating),
    title: `Fraud case ${fraudCase.caseNumber} opened`,
    details: { caseNumber: fraudCase.caseNumber, riskRating: fraudCase.riskRating },
  });
}
