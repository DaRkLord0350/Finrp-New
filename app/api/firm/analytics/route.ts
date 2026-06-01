import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";

async function getFirmAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user || user.userRole !== "CA_FIRM_ADMIN") return null;
  return user;
}

export async function GET() {
  const admin = await getFirmAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = admin.organizationId;
  const now = new Date();

  // Build last-6-months array
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i);
    return { label: format(d, "MMM yy"), start: startOfMonth(d), end: endOfMonth(d) };
  });

  // Monthly task completion data
  const monthlyCompletion = await Promise.all(
    months.map(async ({ label, start, end }) => {
      const [completed, total] = await Promise.all([
        prisma.firmTask.count({
          where: { organizationId: orgId, status: "COMPLETED", completedAt: { gte: start, lte: end } },
        }),
        prisma.firmTask.count({
          where: { organizationId: orgId, createdAt: { gte: start, lte: end } },
        }),
      ]);
      return { month: label, completed, total, rate: total > 0 ? Math.round((completed / total) * 100) : 0 };
    })
  );

  // CA productivity
  const caUsers = await prisma.user.findMany({
    where: { organizationId: orgId, userRole: "CA", isActive: true },
    select: { id: true, name: true, email: true },
  });

  const caProductivity = await Promise.all(
    caUsers.map(async (ca) => {
      const [completed, total, overdue] = await Promise.all([
        prisma.firmTask.count({ where: { assignedCaId: ca.id, organizationId: orgId, status: "COMPLETED" } }),
        prisma.firmTask.count({ where: { assignedCaId: ca.id, organizationId: orgId } }),
        prisma.firmTask.count({
          where: { assignedCaId: ca.id, organizationId: orgId, status: { not: "COMPLETED" }, dueDate: { lt: now } },
        }),
      ]);
      return {
        name: ca.name ?? ca.email,
        completed,
        total,
        overdue,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    })
  );

  // KPIs
  const [totalCustomers, activeCustomers, completedTasks, overdueTasks, pendingTasks] = await Promise.all([
    prisma.customer.count({ where: { organizationId: orgId, deletedAt: null } }),
    prisma.customer.count({
      where: {
        organizationId: orgId,
        deletedAt: null,
        firmTasks: { some: { status: { not: "COMPLETED" } } },
      },
    }),
    prisma.firmTask.count({ where: { organizationId: orgId, status: "COMPLETED" } }),
    prisma.firmTask.count({ where: { organizationId: orgId, status: { not: "COMPLETED" }, dueDate: { lt: now } } }),
    prisma.firmTask.count({ where: { organizationId: orgId, status: { in: ["PENDING", "IN_PROGRESS"] } } }),
  ]);

  const totalTasks = completedTasks + overdueTasks + pendingTasks;
  const complianceRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Customer growth (monthly)
  const customerGrowth = await Promise.all(
    months.map(async ({ label, start, end }) => {
      const count = await prisma.customer.count({
        where: { organizationId: orgId, createdAt: { gte: start, lte: end }, deletedAt: null },
      });
      return { month: label, count };
    })
  );

  // Top performers (CAs with most completed tasks this month)
  const monthStart = startOfMonth(now);
  const topPerformers = await Promise.all(
    caUsers.map(async (ca) => {
      const completedThisMonth = await prisma.firmTask.count({
        where: { assignedCaId: ca.id, organizationId: orgId, status: "COMPLETED", completedAt: { gte: monthStart } },
      });
      return { name: ca.name ?? ca.email, completedThisMonth };
    })
  );
  topPerformers.sort((a, b) => b.completedThisMonth - a.completedThisMonth);

  return NextResponse.json({
    kpis: { complianceRate, totalCustomers, activeCustomers, completedTasks, overdueTasks, pendingTasks },
    monthlyCompletion,
    caProductivity,
    customerGrowth,
    topPerformers: topPerformers.slice(0, 5),
  });
}
