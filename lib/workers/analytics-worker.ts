// ============================================================
// FinRP — Analytics snapshot processor
// Precomputes dashboard/firm/compliance snapshots and invalidates the
// Redis cache so dashboards read stale-while-revalidate data instantly.
// Invoked by the analytics Inngest function (inngest/functions/analytics.ts);
// `all_orgs` is also driven nightly by the analytics cron.
// ============================================================

import { prisma } from "@/lib/prisma";
import { cacheDel, CacheKey } from "@/lib/cache";
import type { AnalyticsJobData } from "./analytics-queue";

/**
 * Dispatch one analytics snapshot job. Tenant invariant: every per-org job
 * carries organizationId and each compute function scopes its queries to
 * that org. `all_orgs` is the ONLY cross-tenant path — an internal
 * maintenance recompute never triggered from user input.
 */
export async function runAnalyticsSnapshot(data: AnalyticsJobData): Promise<void> {
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
