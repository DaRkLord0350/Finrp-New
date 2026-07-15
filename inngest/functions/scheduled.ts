// ============================================================
// Inngest scheduled (cron) functions
// Replace every BullMQ repeatable job and the setInterval-based
// stuck-job checker:
//   • recurring-invoice-scan hourly       — generate due invoices
//   • integration-scheduled-sync every 15 min — refresh due integrations
//   • compliance-reminders   daily 08:00 IST — GST/TDS/IT/ROC reminders
//   • analytics-nightly      daily 02:00 UTC — recompute every org
//   • stuck-job-checker      every 5 min  — recover orphaned imports
//
// TBX balance/statement auto-sync crons land in inngest/functions/tbx-banking.ts
// (Phase 2A/2B) — the Setu-era bank-auto-sync scan was removed with Setu.
// ============================================================

import { inngest } from "@/inngest/client";
import { EVENTS } from "@/inngest/events";
import { prisma } from "@/lib/prisma";
import { enqueueImport, enqueueSync } from "@/lib/jobs/queues";
import { processDueRecurringInvoices } from "@/lib/invoices/workers/recurring-invoice.worker";
import { enqueueEmail, buildTaskDueEmail } from "@/lib/notifications/email";

// ---------------------------------------------------------------------------
// Recurring invoices — generate every schedule whose nextRunDate arrived.
// (Was the BullMQ recurring-invoice repeatable scan.)
// ---------------------------------------------------------------------------
export const recurringInvoiceScan = inngest.createFunction(
  {
    id: "recurring-invoice-scan",
    name: "Recurring Invoice Scan",
    triggers: [{ cron: "0 * * * *" }], // hourly
  },
  async ({ step }) => {
    return step.run("process-due", () => processDueRecurringInvoices());
  }
);

// ---------------------------------------------------------------------------
// Integration scheduled sync — replaces per-integration BullMQ cron jobs
// (scheduleRepeatingSync). One scan dispatches a sync for every ACTIVE
// integration whose syncIntervalMins has elapsed since lastSyncAt.
// ---------------------------------------------------------------------------
export const integrationScheduledSync = inngest.createFunction(
  {
    id: "integration-scheduled-sync",
    name: "Integration Scheduled Sync",
    triggers: [{ cron: "*/15 * * * *" }],
  },
  async () => {
    // Read directly (not via step.run) so Date fields stay Dates — step
    // return values are JSON-serialized, which would stringify lastSyncAt.
    const integrations = await prisma.integration.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        type: true,
        lastSyncAt: true,
        syncIntervalMins: true,
      },
      take: 500,
    });

    const now = Date.now();
    let dispatched = 0;

    for (const integ of integrations) {
      const intervalMs = Math.max(integ.syncIntervalMins, 5) * 60_000;
      const due = !integ.lastSyncAt || now - integ.lastSyncAt.getTime() >= intervalMs;
      if (!due) continue;

      const syncJob = await prisma.syncJob.create({
        data: {
          organizationId: integ.organizationId,
          integrationId: integ.id,
          type: "INCREMENTAL",
          entity: "all",
          status: "QUEUED",
          triggeredBy: "schedule",
          scheduledAt: new Date(),
        },
      });

      await enqueueSync({
        syncJobId: syncJob.id,
        organizationId: integ.organizationId,
        integrationId: integ.id,
        connectorType: integ.type,
        entity: "all",
        isIncremental: true,
      }).catch(() => {});
      dispatched++;
    }

    return { scanned: integrations.length, dispatched };
  }
);

// ---------------------------------------------------------------------------
// Compliance reminders — daily scan that emails assignees about GST / TDS /
// Income Tax / ROC / other compliance tasks due within the next 7 days.
// One email per task per day (dedupe key includes today's date).
// ---------------------------------------------------------------------------
export const complianceReminders = inngest.createFunction(
  {
    id: "compliance-reminders",
    name: "Compliance Reminders",
    triggers: [{ cron: "TZ=Asia/Kolkata 0 8 * * *" }],
  },
  async () => {
    const now = new Date();
    const horizon = new Date(now.getTime() + 7 * 86_400_000);
    const today = now.toISOString().slice(0, 10);

    // Read directly (not via step.run) so dueDate stays a Date.
    const tasks = await prisma.complianceTask.findMany({
      where: {
        status: { notIn: ["COMPLETED"] },
        dueDate: { lte: horizon },
        assignedToId: { not: null },
      },
      select: {
        id: true,
        title: true,
        category: true,
        dueDate: true,
        assignedTo: { select: { email: true, name: true } },
      },
      take: 1000,
    });

    let sent = 0;
    for (const task of tasks) {
      const email = task.assignedTo?.email;
      if (!email) continue;

      const daysUntilDue = Math.max(
        0,
        Math.ceil((task.dueDate.getTime() - now.getTime()) / 86_400_000)
      );
      const dueDateLabel = new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(task.dueDate);

      const html = buildTaskDueEmail({
        recipientName: task.assignedTo?.name ?? "there",
        taskTitle: task.title,
        customerName: `${task.category} compliance`,
        dueDate: dueDateLabel,
        daysUntilDue,
      });

      await enqueueEmail({
        to: email,
        subject: `Reminder: ${task.title} due ${dueDateLabel}`,
        html,
        kind: "compliance-reminder",
        dedupeKey: `compliance-reminder:${task.id}:${today}`,
      }).catch(() => {});
      sent++;
    }

    return { scanned: tasks.length, remindersSent: sent };
  }
);

// ---------------------------------------------------------------------------
// Analytics nightly — recompute snapshots for every org.
// (Was the BullMQ all_orgs repeat job.)
// ---------------------------------------------------------------------------
export const analyticsNightly = inngest.createFunction(
  {
    id: "analytics-nightly",
    name: "Analytics Nightly Recompute",
    triggers: [{ cron: "0 2 * * *" }],
  },
  async ({ step }) => {
    await step.sendEvent("recompute-all-orgs", {
      name: EVENTS.ANALYTICS_SNAPSHOT_REQUESTED,
      data: { type: "all_orgs" },
    });
    return { triggered: true };
  }
);

// ---------------------------------------------------------------------------
// Stuck-job checker — DB-only recovery of imports orphaned by a crash.
// (Was the setInterval checker; no Redis lookups needed now.)
// ---------------------------------------------------------------------------
const PROCESSING_STUCK_MS = 10 * 60 * 1000; // 10 min without heartbeat
const QUEUED_STUCK_MS = 15 * 60 * 1000; // 15 min never picked up
const MAX_AUTO_RETRIES = 3;

export const stuckJobChecker = inngest.createFunction(
  {
    id: "stuck-job-checker",
    name: "Stuck Import Recovery",
    triggers: [{ cron: "*/5 * * * *" }],
  },
  async ({ step }) => {
    const result = await step.run("recover", async () => {
      const now = Date.now();
      let failed = 0;
      let redispatched = 0;

      // PROCESSING with a stale/absent heartbeat → worker crashed → FAIL.
      const procCutoff = new Date(now - PROCESSING_STUCK_MS);
      const stuckProcessing = await prisma.importJob.findMany({
        where: {
          status: "PROCESSING",
          OR: [
            { lastHeartbeatAt: { lt: procCutoff } },
            { AND: [{ lastHeartbeatAt: null }, { startedAt: { lt: procCutoff } }] },
          ],
        },
        select: { id: true },
        take: 50,
      });
      for (const job of stuckProcessing) {
        await prisma.importJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            failedAt: new Date(),
            error: "Worker heartbeat missing — the import process likely crashed. Please retry.",
          },
        });
        failed++;
      }

      // QUEUED but never picked up → re-dispatch (or FAIL after max retries).
      const queuedCutoff = new Date(now - QUEUED_STUCK_MS);
      const stuckQueued = await prisma.importJob.findMany({
        where: { status: "QUEUED", updatedAt: { lt: queuedCutoff } },
        select: { id: true, organizationId: true, entity: true, retryCount: true, fieldMapping: true },
        take: 50,
      });
      for (const job of stuckQueued) {
        if (job.retryCount >= MAX_AUTO_RETRIES || !job.fieldMapping) {
          await prisma.importJob.update({
            where: { id: job.id },
            data: {
              status: "FAILED",
              failedAt: new Date(),
              error: `Import never started after ${Math.round(QUEUED_STUCK_MS / 60000)} min. Max retries reached.`,
            },
          });
          failed++;
          continue;
        }
        await enqueueImport({
          importJobId: job.id,
          organizationId: job.organizationId,
          entity: job.entity,
          options: { skipDuplicates: true, updateExisting: true, dryRun: false },
        }).catch(() => {});
        await prisma.importJob.update({
          where: { id: job.id },
          data: { queuedAt: new Date(), retryCount: { increment: 1 }, error: null },
        });
        redispatched++;
      }

      return { failed, redispatched };
    });

    return result;
  }
);
