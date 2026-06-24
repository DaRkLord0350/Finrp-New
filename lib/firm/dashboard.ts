// ============================================================
// lib/firm/dashboard.ts
//
// Aggregate read-model for the firm Dashboard. Every figure is
// derived live from the database — no cached/mock values.
// ============================================================

import { prisma } from "@/lib/prisma";
import { format, startOfMonth, subMonths } from "date-fns";

export interface FirmDashboardMetrics {
  totalTeamMembers: number;
  activeCas: number;
  totalCustomers: number;
  unassignedCustomers: number;
  pendingOnboardings: number;
  openTasks: number;
  overdueTasks: number;
  completedTasks: number;
}

export interface MonthPoint {
  month: string; // e.g. "Jan"
  value: number;
}

export interface CaWorkloadPoint {
  name: string;
  customers: number;
  openTasks: number;
}

export interface FirmActivityItem {
  id: string;
  action: string;
  actorName: string | null;
  targetEmail: string | null;
  createdAt: string;
}

export interface FirmDashboard {
  metrics: FirmDashboardMetrics;
  customerGrowth: MonthPoint[];
  taskCompletion: MonthPoint[];
  caWorkload: CaWorkloadPoint[];
  activity: FirmActivityItem[];
}

const MONTHS_WINDOW = 6;

function lastMonths(n: number): { key: string; label: string; start: Date }[] {
  const out: { key: string; label: string; start: Date }[] = [];
  const base = startOfMonth(new Date());
  for (let i = n - 1; i >= 0; i--) {
    const start = subMonths(base, i);
    out.push({ key: format(start, "yyyy-MM"), label: format(start, "MMM"), start });
  }
  return out;
}

export async function getFirmDashboard(organizationId: string): Promise<FirmDashboard> {
  const now = new Date();
  const windowStart = subMonths(startOfMonth(now), MONTHS_WINDOW - 1);

  const [
    totalTeamMembers,
    activeCas,
    totalCustomers,
    unassignedCustomers,
    pendingCaInvites,
    pendingCustomerInvites,
    openTasks,
    overdueTasks,
    completedTasks,
    customerRows,
    completedTaskRows,
    caUsers,
    activityRows,
  ] = await Promise.all([
    prisma.user.count({
      where: { organizationId, userRole: { in: ["CA", "CA_FIRM_ADMIN"] } },
    }),
    prisma.user.count({
      where: { organizationId, userRole: { in: ["CA", "CA_FIRM_ADMIN"] }, isActive: true },
    }),
    prisma.customer.count({ where: { organizationId, deletedAt: null } }),
    prisma.customer.count({
      where: {
        organizationId,
        deletedAt: null,
        customerAssignments: { none: { isActive: true } },
      },
    }),
    prisma.invitation.count({
      where: { organizationId, status: { in: ["PENDING", "SENT"] }, expiresAt: { gt: now } },
    }),
    prisma.customerInvitation.count({
      where: { organizationId, status: { in: ["PENDING", "SENT"] }, expiresAt: { gt: now } },
    }),
    prisma.firmTask.count({ where: { organizationId, status: { not: "COMPLETED" } } }),
    prisma.firmTask.count({
      where: { organizationId, status: { not: "COMPLETED" }, dueDate: { lt: now } },
    }),
    prisma.firmTask.count({ where: { organizationId, status: "COMPLETED" } }),
    prisma.customer.findMany({
      where: { organizationId, deletedAt: null },
      select: { createdAt: true },
    }),
    prisma.firmTask.findMany({
      where: { organizationId, status: "COMPLETED", completedAt: { gte: windowStart } },
      select: { completedAt: true },
    }),
    prisma.user.findMany({
      where: { organizationId, userRole: { in: ["CA", "CA_FIRM_ADMIN"] }, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: {
            customerAssignments: { where: { isActive: true } },
            firmTasksAsCa: { where: { status: { not: "COMPLETED" } } },
          },
        },
      },
    }),
    prisma.teamActivityLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const months = lastMonths(MONTHS_WINDOW);

  // Customer growth — cumulative customers at the end of each month.
  const customerGrowth: MonthPoint[] = months.map((m) => {
    const cutoff = subMonths(m.start, -1); // first day of next month
    const value = customerRows.filter((c) => c.createdAt < cutoff).length;
    return { month: m.label, value };
  });

  // Task completion — count completed per month.
  const taskCompletion: MonthPoint[] = months.map((m) => {
    const value = completedTaskRows.filter(
      (t) => t.completedAt && format(t.completedAt, "yyyy-MM") === m.key
    ).length;
    return { month: m.label, value };
  });

  // CA workload — top by active assignments.
  const caWorkload: CaWorkloadPoint[] = caUsers
    .map((u) => ({
      name: (u.name ?? u.email).split(" ")[0],
      customers: u._count.customerAssignments,
      openTasks: u._count.firmTasksAsCa,
    }))
    .sort((a, b) => b.customers - a.customers)
    .slice(0, 8);

  return {
    metrics: {
      totalTeamMembers,
      activeCas,
      totalCustomers,
      unassignedCustomers,
      pendingOnboardings: pendingCaInvites + pendingCustomerInvites,
      openTasks,
      overdueTasks,
      completedTasks,
    },
    customerGrowth,
    taskCompletion,
    caWorkload,
    activity: activityRows.map((a) => ({
      id: a.id,
      action: a.action,
      actorName: a.actorName,
      targetEmail: a.targetEmail,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}
