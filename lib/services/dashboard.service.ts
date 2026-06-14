// ============================================================
// Dashboard Service — aggregated data for dashboard overview
// All queries run in parallel via Promise.all()
// ============================================================

import { prisma } from "@/lib/prisma";
import { complianceRepository } from "@/lib/repositories/compliance.repository";

export type DashboardMetrics = {
  invoices: {
    total: number;
    totalAmount: number;
    paidAmount: number;
    overdueCount: number;
    draftCount: number;
  };
  customers: {
    total: number;
    active: number;
    newThisMonth: number;
  };
  compliance: {
    total: number;
    submitted: number;
    approved: number;
    expiringSoon: number;
    overdue: number;
  };
  revenue: {
    thisMonth: number;
    lastMonth: number;
    growthPercent: number;
  };
};

export async function getDashboardMetrics(organizationId: string): Promise<DashboardMetrics> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    invoiceAgg,
    invoicePaid,
    overdueCount,
    draftCount,
    customerTotal,
    customerActive,
    customerNew,
    complianceStats,
    revenueThisMonth,
    revenueLastMonth,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      where: { organizationId, deletedAt: null },
      _sum: { total: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: { organizationId, status: "PAID", deletedAt: null },
      _sum: { total: true },
    }),
    prisma.invoice.count({ where: { organizationId, status: "OVERDUE", deletedAt: null } }),
    prisma.invoice.count({ where: { organizationId, status: "DRAFT", deletedAt: null } }),
    prisma.customer.count({ where: { organizationId, deletedAt: null } }),
    prisma.customer.count({ where: { organizationId, isActive: true, deletedAt: null } }),
    prisma.customer.count({
      where: { organizationId, deletedAt: null, createdAt: { gte: startOfMonth } },
    }),
    complianceRepository.getDashboardStats(organizationId),
    prisma.invoice.aggregate({
      where: { organizationId, status: "PAID", deletedAt: null, issueDate: { gte: startOfMonth } },
      _sum: { total: true },
    }),
    prisma.invoice.aggregate({
      where: {
        organizationId, status: "PAID", deletedAt: null,
        issueDate: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
      _sum: { total: true },
    }),
  ]);

  const thisMonth = Number(revenueThisMonth._sum.total ?? 0);
  const lastMonth = Number(revenueLastMonth._sum.total ?? 0);
  const growthPercent = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

  return {
    invoices: {
      total: invoiceAgg._count,
      totalAmount: Number(invoiceAgg._sum.total ?? 0),
      paidAmount: Number(invoicePaid._sum.total ?? 0),
      overdueCount,
      draftCount,
    },
    customers: {
      total: customerTotal,
      active: customerActive,
      newThisMonth: customerNew,
    },
    compliance: complianceStats,
    revenue: {
      thisMonth,
      lastMonth,
      growthPercent: Math.round(growthPercent * 10) / 10,
    },
  };
}
