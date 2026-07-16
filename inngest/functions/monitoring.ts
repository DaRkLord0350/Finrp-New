// ============================================================
// inngest/functions/monitoring.ts
//
// Daily sweep, per-organization — mirrors inngest/functions/
// lending.ts's lendingDailyScheduleSweep pattern exactly: find
// distinct organizationIds with relevant data, loop calling a
// per-org evaluator, no persisted "last run" checkpoint (the fixed
// daily cron time + a yesterday-window scan is the checkpoint).
// ============================================================

import { inngest } from "@/inngest/client";
import { prisma } from "@/lib/prisma";
import { evaluateTransactionRules, evaluateRepaymentRules, evaluateCreditScoreDrop } from "@/lib/monitoring/service";

export const monitoringDailySweep = inngest.createFunction(
  { id: "monitoring-daily-sweep", name: "Monitoring — Daily Sweep", triggers: [{ cron: "TZ=Asia/Kolkata 0 7 * * *" }] },
  async ({ step }) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);

    const orgsWithBankAccounts = await step.run("find-orgs-with-bank-accounts", async () => {
      const rows = await prisma.bankAccount.findMany({ where: { deletedAt: null }, select: { organizationId: true }, distinct: ["organizationId"] });
      return rows.map((r) => r.organizationId);
    });
    let transactionAlerts = 0;
    for (const organizationId of orgsWithBankAccounts) {
      transactionAlerts += await evaluateTransactionRules(organizationId, startOfYesterday, startOfToday).catch(() => 0);
    }

    const orgsWithLoanAccounts = await step.run("find-orgs-with-loan-accounts", async () => {
      const rows = await prisma.loanAccount.findMany({ select: { organizationId: true }, distinct: ["organizationId"] });
      return rows.map((r) => r.organizationId);
    });
    let repaymentAlerts = 0;
    for (const organizationId of orgsWithLoanAccounts) {
      repaymentAlerts += await evaluateRepaymentRules(organizationId, startOfYesterday).catch(() => 0);
    }

    const subjectsWithMultipleReports = await step.run("find-subjects-with-multiple-reports", async () => {
      const rows = await prisma.creditReport.groupBy({
        by: ["organizationId", "subjectType", "subjectId"],
        where: { status: "COMPLETED" },
        _count: { _all: true },
      });
      return rows.filter((r) => r._count._all > 1).map((r) => ({ organizationId: r.organizationId, subjectType: r.subjectType as string, subjectId: r.subjectId }));
    });
    let creditAlerts = 0;
    for (const s of subjectsWithMultipleReports) {
      const fired = await evaluateCreditScoreDrop(s.organizationId, s.subjectType, s.subjectId).catch(() => false);
      if (fired) creditAlerts++;
    }

    return {
      orgsSweptForTransactions: orgsWithBankAccounts.length,
      transactionAlerts,
      orgsSweptForRepayment: orgsWithLoanAccounts.length,
      repaymentAlerts,
      creditScoreSubjectsChecked: subjectsWithMultipleReports.length,
      creditAlerts,
    };
  }
);
