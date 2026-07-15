// ============================================================
// Inngest functions — TBX Banking (Balance / Statement / Beneficiary / Payment)
// This file grows across Phase 2A-2D; today it carries balance sync,
// statement sync, and beneficiary lifecycle sync (event-driven + 30-min
// auto-sync crons, same cadence as the removed Setu-era bank-auto-sync
// scan, now filtered on BankConnection.status instead of the removed
// BankAccount.consentStatus).
//   tbx/balance-sync.requested      → syncAccountBalance (lib/tbx/balance/balance.service.ts)
//   tbx/statement-sync.requested    → syncAccountStatement (lib/tbx/statements/statement.sync.ts)
//   tbx/beneficiary-sync.requested  → create/verify/syncVendorBeneficiary (lib/tbx/beneficiaries/beneficiary.service.ts)
// ============================================================

import { inngest } from "@/inngest/client";
import { EVENTS } from "@/inngest/events";
import { prisma } from "@/lib/prisma";
import { startBackgroundJob } from "@/lib/jobs/background-job";
import { syncAccountBalance } from "@/lib/tbx/balance/balance.service";
import { syncAccountStatement } from "@/lib/tbx/statements/statement.sync";
import {
  createVendorBeneficiary,
  verifyVendorBeneficiary,
  syncVendorBeneficiary,
  type BeneficiaryActionOutcome,
} from "@/lib/tbx/beneficiaries/beneficiary.service";
import { dispatchPaymentToTbx, pollPaymentStatus, type PaymentActionOutcome } from "@/lib/tbx/payments/payment.service";

export interface TbxBalanceSyncJobData {
  organizationId: string;
  bankAccountId: string;
  trigger: "MANUAL" | "SCHEDULED";
}

export const tbxBalanceSync = inngest.createFunction(
  {
    id: "tbx-balance-sync",
    name: "TBX Balance Sync",
    concurrency: 5,
    retries: 2,
    triggers: [{ event: EVENTS.TBX_BALANCE_SYNC_REQUESTED }],
  },
  async ({ event, step, runId, attempt }) => {
    const data = event.data as TbxBalanceSyncJobData;

    const bg = await startBackgroundJob({
      type: "tbx.balance-sync",
      organizationId: data.organizationId,
      referenceId: data.bankAccountId,
      idempotencyKey: `tbx.balance-sync:${data.bankAccountId}:${event.id}`,
      eventName: event.name,
      eventId: event.id,
      runId,
      attempt: attempt + 1,
      metadata: { trigger: data.trigger },
    });

    try {
      const result = await step.run("sync-balance", () =>
        syncAccountBalance(data.organizationId, data.bankAccountId)
      );

      if (result.status === "FAILED") {
        await bg.fail(new Error(result.error ?? "Balance sync failed"));
      } else {
        await bg.complete(result);
      }
      return result;
    } catch (err) {
      await bg.fail(err);
      throw err;
    }
  }
);

export interface TbxStatementSyncJobData {
  organizationId: string;
  bankAccountId: string;
  trigger: "MANUAL" | "SCHEDULED";
}

export const tbxStatementSync = inngest.createFunction(
  {
    id: "tbx-statement-sync",
    name: "TBX Statement Sync",
    concurrency: 3,
    retries: 2,
    triggers: [{ event: EVENTS.TBX_STATEMENT_SYNC_REQUESTED }],
  },
  async ({ event, step, runId, attempt }) => {
    const data = event.data as TbxStatementSyncJobData;

    const bg = await startBackgroundJob({
      type: "tbx.statement-sync",
      organizationId: data.organizationId,
      referenceId: data.bankAccountId,
      idempotencyKey: `tbx.statement-sync:${data.bankAccountId}:${event.id}`,
      eventName: event.name,
      eventId: event.id,
      runId,
      attempt: attempt + 1,
      metadata: { trigger: data.trigger },
    });

    try {
      const result = await step.run("sync-statement", () =>
        syncAccountStatement(data.organizationId, data.bankAccountId)
      );

      if (result.status === "FAILED") {
        await bg.fail(new Error(result.error ?? "Statement sync failed"));
      } else {
        await bg.complete(result);
      }
      return result;
    } catch (err) {
      await bg.fail(err);
      throw err;
    }
  }
);

// ---------------------------------------------------------------------------
// Balance auto-sync — find accounts on a live TBX connection due for
// refresh and fan out balance syncs. (Was the Setu-era bank-auto-sync scan.)
// ---------------------------------------------------------------------------
export const tbxBalanceAutoSync = inngest.createFunction(
  { id: "tbx-balance-auto-sync", name: "TBX Balance Auto-Sync Scan", triggers: [{ cron: "*/30 * * * *" }] },
  async ({ step }) => {
    const dueAccounts = await step.run("find-due-accounts", () =>
      prisma.bankAccount.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          autoSyncEnabled: true,
          connection: { status: "CONNECTED" },
          OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: new Date() } }],
        },
        select: { id: true, organizationId: true },
        take: 200,
      })
    );

    for (const account of dueAccounts) {
      await inngest
        .send({
          name: EVENTS.TBX_BALANCE_SYNC_REQUESTED,
          data: { organizationId: account.organizationId, bankAccountId: account.id, trigger: "SCHEDULED" },
          id: `tbx.balance-sync:${account.id}:scheduled:${Math.floor(Date.now() / 60_000)}`,
        })
        .catch(() => {});
    }

    return { dispatched: dueAccounts.length };
  }
);

// ---------------------------------------------------------------------------
// Statement auto-sync — same due-account scan, dispatches statement syncs.
// Runs on the same connections but as its own cron/event so a slow
// statement pull never blocks or gets skipped by a balance-only check.
// ---------------------------------------------------------------------------
export const tbxStatementAutoSync = inngest.createFunction(
  { id: "tbx-statement-auto-sync", name: "TBX Statement Auto-Sync Scan", triggers: [{ cron: "*/30 * * * *" }] },
  async ({ step }) => {
    const dueAccounts = await step.run("find-due-accounts", () =>
      prisma.bankAccount.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          autoSyncEnabled: true,
          connection: { status: "CONNECTED" },
          OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: new Date() } }],
        },
        select: { id: true, organizationId: true },
        take: 200,
      })
    );

    for (const account of dueAccounts) {
      await inngest
        .send({
          name: EVENTS.TBX_STATEMENT_SYNC_REQUESTED,
          data: { organizationId: account.organizationId, bankAccountId: account.id, trigger: "SCHEDULED" },
          id: `tbx.statement-sync:${account.id}:scheduled:${Math.floor(Date.now() / 60_000)}`,
        })
        .catch(() => {});
    }

    return { dispatched: dueAccounts.length };
  }
);

// ---------------------------------------------------------------------------
// Beneficiary sync — single event-driven function handling all three
// vendor-beneficiary lifecycle actions (Create / Verify / Sync), driven by
// the `action` discriminator. This is what the brief calls "Beneficiary
// Sync"; the manual Vendor-page buttons and both crons below all dispatch
// through this one event.
// ---------------------------------------------------------------------------
export interface TbxBeneficiarySyncJobData {
  organizationId: string;
  vendorId: string;
  action: "CREATE" | "VERIFY" | "SYNC";
  trigger: "MANUAL" | "SCHEDULED" | "RETRY";
  actorId?: string | null;
}

export const tbxBeneficiarySync = inngest.createFunction(
  {
    id: "tbx-beneficiary-sync",
    name: "TBX Beneficiary Sync",
    concurrency: 5,
    retries: 2,
    triggers: [{ event: EVENTS.TBX_BENEFICIARY_SYNC_REQUESTED }],
  },
  async ({ event, step, runId, attempt }) => {
    const data = event.data as TbxBeneficiarySyncJobData;

    const bg = await startBackgroundJob({
      type: `tbx.beneficiary-${data.action.toLowerCase()}`,
      organizationId: data.organizationId,
      referenceId: data.vendorId,
      idempotencyKey: `tbx.beneficiary-sync:${data.vendorId}:${event.id}`,
      eventName: event.name,
      eventId: event.id,
      runId,
      attempt: attempt + 1,
      metadata: { action: data.action, trigger: data.trigger },
    });

    try {
      const actor = { userId: data.actorId };
      const result: BeneficiaryActionOutcome = await step.run(`beneficiary-${data.action.toLowerCase()}`, () => {
        switch (data.action) {
          case "CREATE":
            return createVendorBeneficiary(data.organizationId, data.vendorId, actor);
          case "VERIFY":
            return verifyVendorBeneficiary(data.organizationId, data.vendorId, actor);
          case "SYNC":
            return syncVendorBeneficiary(data.organizationId, data.vendorId, actor);
        }
      });

      if (result.status === "FAILED") {
        await bg.fail(new Error(result.error ?? `Beneficiary ${data.action} failed`));
      } else {
        await bg.complete(result);
      }
      return result;
    } catch (err) {
      await bg.fail(err);
      throw err;
    }
  }
);

// ---------------------------------------------------------------------------
// Beneficiary verification poll — finds vendors with a beneficiary that's
// not yet in a terminal verified/approved state and dispatches a SYNC to
// refresh them from TBX.
// ---------------------------------------------------------------------------
export const tbxBeneficiaryVerificationPoll = inngest.createFunction(
  { id: "tbx-beneficiary-verification-poll", name: "TBX Beneficiary Verification Poll", triggers: [{ cron: "*/30 * * * *" }] },
  async ({ step }) => {
    const dueVendors = await step.run("find-due-vendors", () =>
      prisma.vendor.findMany({
        where: {
          deletedAt: null,
          tbxBeneficiaryId: { not: null },
          OR: [
            { tbxVerificationStatus: { in: ["PENDING", "IN_PROGRESS"] } },
            { tbxApprovalStatus: "PENDING" },
            { tbxBeneficiaryStatus: "PENDING" },
          ],
        },
        select: { id: true, organizationId: true },
        take: 200,
      })
    );

    for (const vendor of dueVendors) {
      await inngest
        .send({
          name: EVENTS.TBX_BENEFICIARY_SYNC_REQUESTED,
          data: { organizationId: vendor.organizationId, vendorId: vendor.id, action: "SYNC", trigger: "SCHEDULED" },
          id: `tbx.beneficiary-sync:${vendor.id}:scheduled:${Math.floor(Date.now() / 60_000)}`,
        })
        .catch(() => {});
    }

    return { dispatched: dueVendors.length };
  }
);

// ---------------------------------------------------------------------------
// Retry failed beneficiary syncs — finds vendors whose beneficiary is
// stuck FAILED and retries them on a slower, hourly cadence (distinct from
// the 30-min active-verification poll above so a persistently-broken
// beneficiary doesn't get hammered at the same rate as one that's actively
// progressing through verification).
// ---------------------------------------------------------------------------
const RETRY_BACKOFF_MS = 60 * 60_000;

export const tbxBeneficiaryRetryFailedSyncs = inngest.createFunction(
  { id: "tbx-beneficiary-retry-failed-syncs", name: "TBX Beneficiary Retry Failed Syncs", triggers: [{ cron: "0 * * * *" }] },
  async ({ step }) => {
    const cutoff = new Date(Date.now() - RETRY_BACKOFF_MS);
    const failedVendors = await step.run("find-failed-vendors", () =>
      prisma.vendor.findMany({
        where: {
          deletedAt: null,
          tbxBeneficiaryId: { not: null },
          tbxBeneficiaryStatus: "FAILED",
          OR: [{ tbxLastSyncAt: null }, { tbxLastSyncAt: { lte: cutoff } }],
        },
        select: { id: true, organizationId: true },
        take: 200,
      })
    );

    for (const vendor of failedVendors) {
      await inngest
        .send({
          name: EVENTS.TBX_BENEFICIARY_SYNC_REQUESTED,
          data: { organizationId: vendor.organizationId, vendorId: vendor.id, action: "SYNC", trigger: "RETRY" },
          id: `tbx.beneficiary-sync:${vendor.id}:retry:${Math.floor(Date.now() / 60_000)}`,
        })
        .catch(() => {});
    }

    return { dispatched: failedVendors.length };
  }
);

// ---------------------------------------------------------------------------
// Payment sync — dispatches an approved payment to TBX, then immediately
// polls once so mock-mode (and fast real-world IMPS) payments resolve
// within the same job; anything left PROCESSING is picked up by the
// auto-poll cron below. Webhook delivery (payment.webhook.ts) is the
// primary settlement path — this poll is the redundant fallback the brief
// calls "Payment Sync".
// ---------------------------------------------------------------------------
export interface TbxPaymentSyncJobData {
  organizationId: string;
  paymentId: string;
  action: "DISPATCH" | "POLL";
  trigger: "MANUAL" | "SCHEDULED";
}

export const tbxPaymentSync = inngest.createFunction(
  {
    id: "tbx-payment-sync",
    name: "TBX Payment Sync",
    concurrency: 5,
    retries: 2,
    triggers: [{ event: EVENTS.TBX_PAYMENT_SYNC_REQUESTED }],
  },
  async ({ event, step, runId, attempt }) => {
    const data = event.data as TbxPaymentSyncJobData;

    const bg = await startBackgroundJob({
      type: `tbx.payment-${data.action.toLowerCase()}`,
      organizationId: data.organizationId,
      referenceId: data.paymentId,
      idempotencyKey: `tbx.payment-sync:${data.paymentId}:${event.id}`,
      eventName: event.name,
      eventId: event.id,
      runId,
      attempt: attempt + 1,
      metadata: { action: data.action, trigger: data.trigger },
    });

    try {
      let result: PaymentActionOutcome = await step.run(data.action.toLowerCase(), () =>
        data.action === "DISPATCH"
          ? dispatchPaymentToTbx(data.organizationId, data.paymentId)
          : pollPaymentStatus(data.organizationId, data.paymentId)
      );

      if (data.action === "DISPATCH" && result.status === "SUCCESS") {
        result = await step.run("poll-once", () => pollPaymentStatus(data.organizationId, data.paymentId));
      }

      if (result.status === "FAILED") {
        await bg.fail(new Error(result.error ?? `Payment ${data.action} failed`));
      } else {
        await bg.complete(result);
      }
      return result;
    } catch (err) {
      await bg.fail(err);
      throw err;
    }
  }
);

// ---------------------------------------------------------------------------
// Payment auto-poll — finds payments dispatched to TBX but not yet in a
// terminal state and re-checks them. Faster cadence than beneficiary
// polling since settlement confirmation is more time-sensitive.
// ---------------------------------------------------------------------------
export const tbxPaymentAutoPoll = inngest.createFunction(
  { id: "tbx-payment-auto-poll", name: "TBX Payment Auto-Poll", triggers: [{ cron: "*/15 * * * *" }] },
  async ({ step }) => {
    const duePayments = await step.run("find-due-payments", () =>
      prisma.vendorPayment.findMany({
        where: { deletedAt: null, status: { in: ["SUBMITTED", "PROCESSING"] }, tbxPaymentId: { not: null } },
        select: { id: true, organizationId: true },
        take: 200,
      })
    );

    for (const payment of duePayments) {
      await inngest
        .send({
          name: EVENTS.TBX_PAYMENT_SYNC_REQUESTED,
          data: { organizationId: payment.organizationId, paymentId: payment.id, action: "POLL", trigger: "SCHEDULED" },
          id: `tbx.payment-sync:${payment.id}:scheduled:${Math.floor(Date.now() / 60_000)}`,
        })
        .catch(() => {});
    }

    return { dispatched: duePayments.length };
  }
);
