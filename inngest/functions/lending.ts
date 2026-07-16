// ============================================================
// inngest/functions/lending.ts
//
// Async steps for the Lending Platform:
//   • lendingDisbursementPoll / lendingCollectionPoll — one-shot,
//     event-driven checks fired right after initiate.
//   • lendingDisbursementAutoPoll / lendingCollectionAutoPoll — cron
//     sweeps that retry anything still PROCESSING/INITIATED.
//   • lendingDailyScheduleSweep — daily: flip EMISchedule rows past
//     their due date to DUE/OVERDUE, trigger auto-debit collection for
//     installments due today on an ACTIVE mandate, then refresh
//     collection-case DPD buckets + NPA flags.
// Mirrors inngest/functions/tbx-banking.ts's dispatch+cron shape.
// ============================================================

import { inngest } from "@/inngest/client";
import { EVENTS } from "@/inngest/events";
import { prisma } from "@/lib/prisma";
import { startBackgroundJob } from "@/lib/jobs/background-job";
import { completeDisbursement } from "@/lib/lending/disbursement";
import { completeCollection, collectDueEmi } from "@/lib/lending/repayment";
import { syncCollectionCases } from "@/lib/lending/collections";

// ---------------------------------------------------------------------------
// Event-driven: one-shot poll right after initiate
// ---------------------------------------------------------------------------

export const lendingDisbursementPoll = inngest.createFunction(
  {
    id: "lending-disbursement-poll",
    name: "Lending — Disbursement Poll",
    concurrency: 5,
    retries: 3,
    triggers: [{ event: EVENTS.LENDING_DISBURSEMENT_POLL_REQUESTED }],
  },
  async ({ event, step, runId, attempt }) => {
    const data = event.data;
    const bg = await startBackgroundJob({
      type: "lending.disbursement-poll",
      organizationId: data.organizationId,
      referenceId: data.disbursementId,
      idempotencyKey: `lending.disbursement-poll:${data.disbursementId}:${event.id ?? runId}`,
      eventName: event.name,
      eventId: event.id,
      runId,
      attempt: attempt + 1,
    });
    try {
      const result = await step.run("poll-disbursement", () =>
        completeDisbursement(data.disbursementId, data.organizationId, { userId: data.actorId })
      );
      await bg.complete({ status: result.status });
      return { disbursementId: data.disbursementId, status: result.status };
    } catch (err) {
      await bg.fail(err);
      throw err;
    }
  }
);

export const lendingCollectionPoll = inngest.createFunction(
  {
    id: "lending-collection-poll",
    name: "Lending — Collection Poll",
    concurrency: 10,
    retries: 3,
    triggers: [{ event: EVENTS.LENDING_COLLECTION_POLL_REQUESTED }],
  },
  async ({ event, step }) => {
    const data = event.data;
    const result = await step.run("poll-collection", () => completeCollection(data.repaymentId, data.organizationId));
    return { repaymentId: data.repaymentId, status: result.status };
  }
);

// ---------------------------------------------------------------------------
// Cron sweeps — retry anything still in-flight
// ---------------------------------------------------------------------------

export const lendingDisbursementAutoPoll = inngest.createFunction(
  { id: "lending-disbursement-auto-poll", name: "Lending — Disbursement Auto-Poll", triggers: [{ cron: "*/5 * * * *" }] },
  async () => {
    const processing = await prisma.loanDisbursement.findMany({
      where: { status: "PROCESSING", paymentReferenceId: { not: null } },
      select: { id: true, organizationId: true, initiatedById: true },
      take: 200,
    });

    let completed = 0;
    for (const d of processing) {
      const result = await completeDisbursement(d.id, d.organizationId, { userId: d.initiatedById ?? "system" }).catch(() => null);
      if (result?.status === "COMPLETED") completed++;
    }
    return { scanned: processing.length, completed };
  }
);

export const lendingCollectionAutoPoll = inngest.createFunction(
  { id: "lending-collection-auto-poll", name: "Lending — Collection Auto-Poll", triggers: [{ cron: "*/5 * * * *" }] },
  async () => {
    const inFlight = await prisma.loanRepayment.findMany({
      where: { status: "INITIATED", paymentReferenceId: { not: null } },
      select: { id: true, organizationId: true },
      take: 200,
    });

    let resolved = 0;
    for (const r of inFlight) {
      const result = await completeCollection(r.id, r.organizationId).catch(() => null);
      if (result && result.status !== "INITIATED") resolved++;
    }
    return { scanned: inFlight.length, resolved };
  }
);

// ---------------------------------------------------------------------------
// Daily sweep — schedule status refresh, auto-debit trigger, DPD/NPA sync
// ---------------------------------------------------------------------------

export const lendingDailyScheduleSweep = inngest.createFunction(
  { id: "lending-daily-schedule-sweep", name: "Lending — Daily Schedule Sweep", triggers: [{ cron: "TZ=Asia/Kolkata 0 6 * * *" }] },
  async ({ step }) => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 86_400_000);

    // 1) Flip UPCOMING -> DUE for installments due today, UPCOMING/DUE -> OVERDUE for anything past due.
    const dueTodayCount = await step.run("flip-due-today", () =>
      prisma.eMISchedule.updateMany({
        where: { status: "UPCOMING", dueDate: { gte: startOfToday, lt: endOfToday } },
        data: { status: "DUE" },
      })
    );
    const overdueCount = await step.run("flip-overdue", () =>
      prisma.eMISchedule.updateMany({
        where: { status: { in: ["UPCOMING", "DUE"] }, dueDate: { lt: startOfToday } },
        data: { status: "OVERDUE" },
      })
    );

    // 2) Auto-debit installments due today on loan accounts with an ACTIVE mandate.
    const dueToday = await step.run("find-due-today", () =>
      prisma.eMISchedule.findMany({
        where: {
          dueDate: { gte: startOfToday, lt: endOfToday },
          status: { in: ["DUE", "OVERDUE"] },
          loanAccount: { mandateStatus: "ACTIVE" },
        },
        select: { id: true, loanAccount: { select: { organizationId: true } } },
        take: 500,
      })
    );
    let autoDebited = 0;
    for (const emi of dueToday) {
      const ok = await collectDueEmi(emi.id, emi.loanAccount.organizationId).catch(() => null);
      if (ok) autoDebited++;
    }

    // 3) Refresh DPD buckets + NPA flags for every organization with overdue accounts.
    const orgsWithOverdue = await step.run("find-orgs-with-overdue", async () => {
      const rows = await prisma.loanAccount.findMany({
        where: { status: { in: ["ACTIVE", "NPA_SUBSTANDARD", "NPA_DOUBTFUL"] }, nextDueDate: { lt: today } },
        select: { organizationId: true },
        distinct: ["organizationId"],
        take: 500,
      });
      return rows.map((r) => r.organizationId);
    });
    let casesTouched = 0;
    for (const organizationId of orgsWithOverdue) {
      const results = await syncCollectionCases(organizationId).catch(() => []);
      casesTouched += results.length;
    }

    return {
      dueTodayFlipped: dueTodayCount.count,
      overdueFlipped: overdueCount.count,
      autoDebitAttempted: dueToday.length,
      autoDebited,
      orgsSwept: orgsWithOverdue.length,
      casesTouched,
    };
  }
);
