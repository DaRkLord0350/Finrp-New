// ============================================================
// FinRP Accounting — Bulk Account Update worker (BullMQ)
// Replaces all references to `fromAccountId` with `toAccountId` across the
// selected source documents, tenant-scoped, with progress tracking.
// ============================================================

import { Worker, Queue, type Job } from "bullmq";
import { Prisma } from "@prisma/client";
import { getRedisConnection } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

export const ACCOUNTING_BULK_QUEUE = "finrp-accounting-bulk";

export interface BulkAccountUpdateJobData {
  jobId: string; // BulkAccountUpdateJob.id
  organizationId: string;
}

// ── Scope registry ─────────────────────────────────────────
// Each scope knows how to count and how to replace the account reference,
// always scoped to the organization.
type ScopeHandler = {
  label: string;
  count: (orgId: string, fromId: string) => Promise<number>;
  update: (orgId: string, fromId: string, toId: string) => Promise<number>;
};

export const BULK_SCOPES: Record<string, ScopeHandler> = {
  invoices: {
    label: "Invoices",
    count: (org, from) => prisma.invoice.count({ where: { organizationId: org, incomeAccountId: from } }),
    update: async (org, from, to) => (await prisma.invoice.updateMany({ where: { organizationId: org, incomeAccountId: from }, data: { incomeAccountId: to } })).count,
  },
  invoice_items: {
    label: "Invoice line items",
    count: (org, from) => prisma.invoiceItem.count({ where: { incomeAccountId: from, invoice: { organizationId: org } } }),
    update: (org, from, to) => prisma.$executeRaw`UPDATE "invoice_items" SET "incomeAccountId" = ${to} WHERE "incomeAccountId" = ${from} AND "invoiceId" IN (SELECT id FROM "invoices" WHERE "organizationId" = ${org})`,
  },
  payments: {
    label: "Payments",
    count: (org, from) => prisma.payment.count({ where: { organizationId: org, depositToAccountId: from } }),
    update: async (org, from, to) => (await prisma.payment.updateMany({ where: { organizationId: org, depositToAccountId: from }, data: { depositToAccountId: to } })).count,
  },
  expenses: {
    label: "Expenses",
    count: (org, from) => prisma.expense.count({ where: { organizationId: org, paymentAccountId: from } }),
    update: async (org, from, to) => (await prisma.expense.updateMany({ where: { organizationId: org, paymentAccountId: from }, data: { paymentAccountId: to } })).count,
  },
  purchases: {
    label: "Bills / Purchase Orders",
    count: (org, from) => prisma.purchase.count({ where: { organizationId: org, expenseAccountId: from } }),
    update: async (org, from, to) => (await prisma.purchase.updateMany({ where: { organizationId: org, expenseAccountId: from }, data: { expenseAccountId: to } })).count,
  },
  purchase_items: {
    label: "Bill line items",
    count: (org, from) => prisma.purchaseItem.count({ where: { expenseAccountId: from, purchase: { organizationId: org } } }),
    update: (org, from, to) => prisma.$executeRaw`UPDATE "purchase_items" SET "expenseAccountId" = ${to} WHERE "expenseAccountId" = ${from} AND "purchaseId" IN (SELECT id FROM "purchases" WHERE "organizationId" = ${org})`,
  },
  vendor_credits: {
    label: "Vendor credits / credit notes",
    count: (org, from) => prisma.creditNote.count({ where: { organizationId: org, accountId: from } }),
    update: async (org, from, to) => (await prisma.creditNote.updateMany({ where: { organizationId: org, accountId: from }, data: { accountId: to } })).count,
  },
  vendors: {
    label: "Vendors (A/P account)",
    count: (org, from) => prisma.vendor.count({ where: { organizationId: org, payableAccountId: from } }),
    update: async (org, from, to) => (await prisma.vendor.updateMany({ where: { organizationId: org, payableAccountId: from }, data: { payableAccountId: to } })).count,
  },
  journal_lines: {
    label: "Journal lines",
    count: (org, from) => prisma.journalLine.count({ where: { accountId: from, journalEntry: { organizationId: org } } }),
    update: (org, from, to) => prisma.$executeRaw`UPDATE "journal_lines" SET "accountId" = ${to} WHERE "accountId" = ${from} AND "journalEntryId" IN (SELECT id FROM "journal_entries" WHERE "organizationId" = ${org})`,
  },
};

export const BULK_SCOPE_KEYS = Object.keys(BULK_SCOPES);

// ── Queue ──────────────────────────────────────────────────
let queue: Queue<BulkAccountUpdateJobData> | null = null;
export function getAccountingBulkQueue(): Queue<BulkAccountUpdateJobData> {
  if (!queue) {
    queue = new Queue<BulkAccountUpdateJobData>(ACCOUNTING_BULK_QUEUE, {
      connection: getRedisConnection("queue"),
      defaultJobOptions: { attempts: 2, backoff: { type: "exponential", delay: 3000 }, removeOnComplete: { count: 200 }, removeOnFail: { count: 100 } },
    });
  }
  return queue;
}

export async function enqueueBulkAccountUpdate(data: BulkAccountUpdateJobData): Promise<string> {
  const q = getAccountingBulkQueue();
  const job = await q.add("bulk-account-update", data, { jobId: `bulk-acct:${data.jobId}` });
  return job.id ?? data.jobId;
}

// ── Core processing (exported so it can run inline too) ─────
export async function runBulkAccountUpdate(jobId: string): Promise<void> {
  const job = await prisma.bulkAccountUpdateJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error(`Bulk update job ${jobId} not found`);
  if (job.status === "COMPLETED") return;

  const { organizationId, fromAccountId, toAccountId } = job;
  const scopes = job.scopes.filter((s) => BULK_SCOPES[s]);

  await prisma.bulkAccountUpdateJob.update({ where: { id: jobId }, data: { status: "RUNNING", startedAt: new Date(), error: null } });

  try {
    // Count first for an accurate total.
    let total = 0;
    const counts: Record<string, number> = {};
    for (const s of scopes) counts[s] = await BULK_SCOPES[s].count(organizationId, fromAccountId);
    total = Object.values(counts).reduce((a, b) => a + b, 0);
    await prisma.bulkAccountUpdateJob.update({ where: { id: jobId }, data: { totalRecords: total } });

    let processed = 0;
    const applied: Record<string, number> = {};
    for (const s of scopes) {
      const n = await BULK_SCOPES[s].update(organizationId, fromAccountId, toAccountId);
      applied[s] = n;
      processed += n;
      await prisma.bulkAccountUpdateJob.update({ where: { id: jobId }, data: { processedRecords: processed, perEntityCounts: applied as Prisma.InputJsonValue } });
    }

    await prisma.bulkAccountUpdateJob.update({
      where: { id: jobId },
      data: { status: "COMPLETED", completedAt: new Date(), processedRecords: processed, perEntityCounts: applied as Prisma.InputJsonValue },
    });

    await createAuditLog({
      organizationId,
      action: "UPDATE",
      entity: "bulk_account_update",
      entityId: jobId,
      description: `Bulk account update: replaced account ${fromAccountId} → ${toAccountId} across ${processed} record(s)`,
      newValue: applied as Prisma.InputJsonValue,
    });
  } catch (err) {
    await prisma.bulkAccountUpdateJob.update({
      where: { id: jobId },
      data: { status: "FAILED", error: err instanceof Error ? err.message : String(err), completedAt: new Date() },
    });
    throw err;
  }
}

// ── Worker ─────────────────────────────────────────────────
export function createBulkAccountUpdateWorker(): Worker<BulkAccountUpdateJobData> {
  return new Worker<BulkAccountUpdateJobData>(
    ACCOUNTING_BULK_QUEUE,
    async (job: Job<BulkAccountUpdateJobData>) => {
      await runBulkAccountUpdate(job.data.jobId);
    },
    { connection: getRedisConnection("worker"), concurrency: 1 }
  );
}
