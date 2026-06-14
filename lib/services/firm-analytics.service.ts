// ============================================================
// Firm Analytics Service — aggregated data for firm analytics page
// ============================================================

import { prisma } from "@/lib/prisma";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";

export type FirmAnalytics = {
  kpis: { complianceRate: number; totalCustomers: number; activeCustomers: number; completedTasks: number; overdueTasks: number; pendingTasks: number };
  monthlyCompletion: { month: string; completed: number; total: number; rate: number }[];
  caProductivity: { name: string; completed: number; total: number; overdue: number; rate: number }[];
  customerGrowth: { month: string; count: number }[];
  topPerformers: { name: string; completedThisMonth: number }[];
};

export async function getFirmAnalytics(organizationId: string): Promise<FirmAnalytics> {
  const now = new Date();
  const monthStart = startOfMonth(now);

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i);
    return { label: format(d, "MMM yy"), start: startOfMonth(d), end: endOfMonth(d) };
  });

  const caUsers = await prisma.user.findMany({
    where: { organizationId, userRole: "CA", isActive: true },
    select: { id: true, name: true, email: true },
  });

  // Run all monthly and KPI queries in parallel
  const [
    kpiResults,
    monthlyData,
    growthData,
    caData,
  ] = await Promise.all([
    Promise.all([
      prisma.customer.count({ where: { organizationId, deletedAt: null } }),
      prisma.customer.count({ where: { organizationId, deletedAt: null, firmTasks: { some: { status: { not: "COMPLETED" } } } } }),
      prisma.firmTask.count({ where: { organizationId, status: "COMPLETED" } }),
      prisma.firmTask.count({ where: { organizationId, status: { not: "COMPLETED" }, dueDate: { lt: now } } }),
      prisma.firmTask.count({ where: { organizationId, status: { in: ["PENDING", "IN_PROGRESS"] } } }),
    ]),
    Promise.all(
      months.map(async ({ label, start, end }) => {
        const [completed, total] = await Promise.all([
          prisma.firmTask.count({ where: { organizationId, status: "COMPLETED", completedAt: { gte: start, lte: end } } }),
          prisma.firmTask.count({ where: { organizationId, createdAt: { gte: start, lte: end } } }),
        ]);
        return { month: label, completed, total, rate: total > 0 ? Math.round((completed / total) * 100) : 0 };
      })
    ),
    Promise.all(
      months.map(async ({ label, start, end }) => {
        const count = await prisma.customer.count({ where: { organizationId, createdAt: { gte: start, lte: end }, deletedAt: null } });
        return { month: label, count };
      })
    ),
    Promise.all(
      caUsers.map(async (ca) => {
        const [completed, total, overdue, completedThisMonth] = await Promise.all([
          prisma.firmTask.count({ where: { assignedCaId: ca.id, organizationId, status: "COMPLETED" } }),
          prisma.firmTask.count({ where: { assignedCaId: ca.id, organizationId } }),
          prisma.firmTask.count({ where: { assignedCaId: ca.id, organizationId, status: { not: "COMPLETED" }, dueDate: { lt: now } } }),
          prisma.firmTask.count({ where: { assignedCaId: ca.id, organizationId, status: "COMPLETED", completedAt: { gte: monthStart } } }),
        ]);
        return {
          id: ca.id,
          name: ca.name ?? ca.email,
          completed, total, overdue,
          rate: total > 0 ? Math.round((completed / total) * 100) : 0,
          completedThisMonth,
        };
      })
    ),
  ]);

  const [totalCustomers, activeCustomers, completedTasks, overdueTasks, pendingTasks] = kpiResults;
  const totalTasks = completedTasks + overdueTasks + pendingTasks;
  const complianceRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const topPerformers = [...caData]
    .sort((a, b) => b.completedThisMonth - a.completedThisMonth)
    .slice(0, 5)
    .map(({ id: _id, completedThisMonth, ...rest }) => ({ ...rest, completedThisMonth }));

  const caProductivity = caData.map(({ id: _id, completedThisMonth: _c, ...rest }) => rest);

  return {
    kpis: { complianceRate, totalCustomers, activeCustomers, completedTasks, overdueTasks, pendingTasks },
    monthlyCompletion: monthlyData,
    caProductivity,
    customerGrowth: growthData,
    topPerformers,
  };
}
