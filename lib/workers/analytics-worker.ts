// ============================================================
// FinRP — Analytics Background Worker
// Run this in a separate process: `node lib/workers/start.js`
// Each job precomputes snapshots and invalidates Redis cache
// so dashboards read stale-while-revalidate data instantly.
// ============================================================

import { Worker } from "bullmq";
import { BULLMQ_CONNECTION } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { cacheDel, CacheKey } from "@/lib/cache";
import type { AnalyticsJobData } from "./analytics-queue";

export function startAnalyticsWorker() {
  const worker = new Worker<AnalyticsJobData>(
    "analytics",
    async (job) => {
      const data = job.data;

      switch (data.type) {
        case "dashboard":
          await computeDashboardSnapshot(data.organizationId);
          break;
        case "monthly":
          await computeMonthlyRevenue(data.organizationId, data.year, data.month);
          break;
        case "firm":
          await computeFirmSnapshot(data.organizationId);
          break;
        case "compliance":
          await computeComplianceStat(data.organizationId);
          break;
        case "all_orgs":
          await recomputeAllOrgs();
          break;
      }
    },
    {
      connection: BULLMQ_CONNECTION,
      // concurrency=2: each job fires up to 9 parallel DB queries;
      // 2 concurrent jobs = ~18 peak DB ops, safely within pool max.
      // Was 5 (45 peak ops) which, combined with the main app pool,
      // exceeded the Supabase free-tier session limit (pool_size=15).
      concurrency: 2,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[analytics-worker] completed ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[analytics-worker] failed ${job?.id}:`, err.message);
  });

  return worker;
}

// ---------------------------------------------------------------------------
// Dashboard KPI snapshot
// ---------------------------------------------------------------------------
async function computeDashboardSnapshot(organizationId: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    revenueAgg,
    prevMonthAgg,
    totalCustomers,
    totalInvoices,
    overdueInvoices,
    paidInvoices,
    newCustomers,
    activeLoans,
    complianceDue,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      where: { organizationId, status: "PAID" },
      _sum: { total: true },
    }),
    prisma.invoice.aggregate({
      where: {
        organizationId,
        status: "PAID",
        issueDate: { gte: startOfPrevMonth, lt: startOfMonth },
      },
      _sum: { total: true },
    }),
    prisma.customer.count({ where: { organizationId } }),
    prisma.invoice.count({ where: { organizationId } }),
    prisma.invoice.count({ where: { organizationId, status: "OVERDUE" } }),
    prisma.invoice.count({ where: { organizationId, status: "PAID" } }),
    prisma.customer.count({ where: { organizationId, createdAt: { gte: startOfMonth } } }),
    prisma.loan.count({ where: { organizationId, status: "ACTIVE" } }),
    prisma.complianceTask.count({
      where: {
        organizationId,
        status: { not: "COMPLETED" },
        dueDate: { lte: new Date(now.getTime() + 7 * 86400_000) },
      },
    }),
  ]);

  const totalRevenue = Number(revenueAgg._sum.total ?? 0);
  const prevRevenue  = Number(prevMonthAgg._sum.total ?? 0);
  const growth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  await prisma.dashboardSnapshot.upsert({
    where: {
      organizationId_snapshotDate_period: {
        organizationId,
        snapshotDate: today,
        period: "daily",
      },
    },
    create: {
      organizationId,
      snapshotDate: today,
      period: "daily",
      totalRevenue,
      totalCustomers,
      totalInvoices,
      overdueInvoices,
      paidInvoices,
      revenueGrowth: Math.round(growth * 10) / 10,
      newCustomers,
      activeLoans,
      complianceDue,
    },
    update: {
      totalRevenue,
      totalCustomers,
      totalInvoices,
      overdueInvoices,
      paidInvoices,
      revenueGrowth: Math.round(growth * 10) / 10,
      newCustomers,
      activeLoans,
      complianceDue,
      computedAt: now,
    },
  });

  // Bust the live dashboard cache so next read pulls fresh snapshot
  await cacheDel(CacheKey.dashboard(organizationId));
}

// ---------------------------------------------------------------------------
// Monthly revenue snapshot
// ---------------------------------------------------------------------------
async function computeMonthlyRevenue(
  organizationId: string,
  year: number,
  month: number
) {
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 0, 23, 59, 59, 999);

  const [revenueAgg, overdueCount, paidCount, invoiceCount, newCustomers, expenseAgg] =
    await Promise.all([
      prisma.invoice.aggregate({
        where: { organizationId, status: "PAID", issueDate: { gte: start, lte: end } },
        _sum: { total: true },
      }),
      prisma.invoice.count({
        where: { organizationId, status: "OVERDUE", issueDate: { gte: start, lte: end } },
      }),
      prisma.invoice.count({
        where: { organizationId, status: "PAID", issueDate: { gte: start, lte: end } },
      }),
      prisma.invoice.count({
        where: { organizationId, issueDate: { gte: start, lte: end } },
      }),
      prisma.customer.count({
        where: { organizationId, createdAt: { gte: start, lte: end } },
      }),
      prisma.expense.aggregate({
        where: { organizationId, expenseDate: { gte: start, lte: end }, deletedAt: null },
        _sum: { amount: true },
      }),
    ]);

  await prisma.monthlyRevenueStat.upsert({
    where: { organizationId_year_month: { organizationId, year, month } },
    create: {
      organizationId,
      year,
      month,
      revenue:      Number(revenueAgg._sum.total ?? 0),
      invoiceCount,
      paidCount,
      overdueCount,
      newCustomers,
      expenseTotal: Number(expenseAgg._sum.amount ?? 0),
    },
    update: {
      revenue:      Number(revenueAgg._sum.total ?? 0),
      invoiceCount,
      paidCount,
      overdueCount,
      newCustomers,
      expenseTotal: Number(expenseAgg._sum.amount ?? 0),
      computedAt:   new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Firm snapshot (CA portal)
// ---------------------------------------------------------------------------
async function computeFirmSnapshot(organizationId: string) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [totalClients, activeTasks, overdueTasks, completedTasks, unreadMessages] =
    await Promise.all([
      prisma.cAClient.count({ where: { organization: { id: organizationId }, isActive: true } }),
      prisma.firmTask.count({ where: { organizationId, status: { in: ["PENDING", "IN_PROGRESS", "REVIEW"] } } }),
      prisma.firmTask.count({
        where: {
          organizationId,
          status: { not: "COMPLETED" },
          dueDate: { lt: now },
        },
      }),
      prisma.firmTask.count({ where: { organizationId, status: "COMPLETED" } }),
      prisma.message.count({ where: { organizationId, isRead: false } }),
    ]);

  await prisma.firmSnapshot.upsert({
    where: { organizationId_snapshotDate: { organizationId, snapshotDate: today } },
    create: {
      organizationId,
      snapshotDate: today,
      totalClients,
      activeTasks,
      overdueTasks,
      completedTasks,
      pendingDocs: 0,
      unreadMessages,
    },
    update: {
      totalClients,
      activeTasks,
      overdueTasks,
      completedTasks,
      unreadMessages,
      computedAt: now,
    },
  });

  await cacheDel(CacheKey.firmStats(organizationId));
}

// ---------------------------------------------------------------------------
// Compliance stats snapshot
// ---------------------------------------------------------------------------
async function computeComplianceStat(organizationId: string) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const in7d  = new Date(now.getTime() + 7  * 86400_000);
  const in30d = new Date(now.getTime() + 30 * 86400_000);

  const counts = await prisma.complianceSubmission.groupBy({
    by: ["status"],
    where: { organizationId, deletedAt: null },
    _count: { id: true },
  });

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count.id]));

  const [dueSoon7d, dueSoon30d] = await Promise.all([
    prisma.complianceSubmission.count({
      where: {
        organizationId,
        deletedAt: null,
        status: { not: "APPROVED" },
        expiryDate: { lte: in7d, gte: now },
      },
    }),
    prisma.complianceSubmission.count({
      where: {
        organizationId,
        deletedAt: null,
        status: { not: "APPROVED" },
        expiryDate: { lte: in30d, gte: now },
      },
    }),
  ]);

  await prisma.complianceStat.upsert({
    where: { organizationId_snapshotDate: { organizationId, snapshotDate: today } },
    create: {
      organizationId,
      snapshotDate: today,
      totalSubmissions: counts.reduce((s, c) => s + c._count.id, 0),
      draftCount:       byStatus["DRAFT"]        ?? 0,
      submittedCount:   byStatus["SUBMITTED"]    ?? 0,
      approvedCount:    byStatus["APPROVED"]     ?? 0,
      rejectedCount:    byStatus["REJECTED"]     ?? 0,
      expiredCount:     byStatus["EXPIRED"]      ?? 0,
      dueSoon7d,
      dueSoon30d,
    },
    update: {
      totalSubmissions: counts.reduce((s, c) => s + c._count.id, 0),
      draftCount:       byStatus["DRAFT"]        ?? 0,
      submittedCount:   byStatus["SUBMITTED"]    ?? 0,
      approvedCount:    byStatus["APPROVED"]     ?? 0,
      rejectedCount:    byStatus["REJECTED"]     ?? 0,
      expiredCount:     byStatus["EXPIRED"]      ?? 0,
      dueSoon7d,
      dueSoon30d,
      computedAt: now,
    },
  });
}

// ---------------------------------------------------------------------------
// Admin cron: recompute all orgs (run nightly via BullMQ repeat)
// Processes in batches of 3 to avoid thundering-herd on the DB pool.
// allSettled per batch so a single org failure doesn't halt the entire run.
// ---------------------------------------------------------------------------
async function recomputeAllOrgs() {
  const orgs = await prisma.organization.findMany({
    select:  { id: true },
    orderBy: { createdAt: "asc" },
  });

  const BATCH = 3;
  const now   = new Date();

  for (let i = 0; i < orgs.length; i += BATCH) {
    await Promise.allSettled(
      orgs.slice(i, i + BATCH).map(async ({ id }) => {
        await computeDashboardSnapshot(id);
        await computeMonthlyRevenue(id, now.getFullYear(), now.getMonth() + 1);
      })
    );
  }
}
