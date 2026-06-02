import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { startOfMonth, endOfMonth } from "date-fns";

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
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // All CAs in this org
  const caUsers = await prisma.user.findMany({
    where: { organizationId: orgId, userRole: "CA", isActive: true },
    select: { id: true, name: true, email: true },
  });

  // Aggregate workload per CA
  const workloadData = await Promise.all(
    caUsers.map(async (ca) => {
      const [
        assignedClients,
        pendingTasks,
        inProgressTasks,
        completedThisMonth,
        overdueTasks,
      ] = await Promise.all([
        prisma.customerAssignment.count({ where: { caId: ca.id, isActive: true } }),
        prisma.firmTask.count({ where: { assignedCaId: ca.id, organizationId: orgId, status: "PENDING" } }),
        prisma.firmTask.count({ where: { assignedCaId: ca.id, organizationId: orgId, status: "IN_PROGRESS" } }),
        prisma.firmTask.count({
          where: {
            assignedCaId: ca.id,
            organizationId: orgId,
            status: "COMPLETED",
            completedAt: { gte: monthStart, lte: monthEnd },
          },
        }),
        prisma.firmTask.count({
          where: {
            assignedCaId: ca.id,
            organizationId: orgId,
            status: { not: "COMPLETED" },
            dueDate: { lt: now },
          },
        }),
      ]);

      const activeTasks = pendingTasks + inProgressTasks;
      // Workload % based on active tasks (>10 = 100%)
      const workloadPct = Math.min(100, Math.round((activeTasks / 10) * 100));

      return {
        ca,
        assignedClients,
        pendingTasks,
        inProgressTasks,
        completedThisMonth,
        overdueTasks,
        activeTasks,
        workloadPct,
        isOverloaded: workloadPct >= 90,
      };
    })
  );

  // Summary stats
  const [totalCustomers, pendingAll, overdueAll] = await Promise.all([
    prisma.customer.count({ where: { organizationId: orgId, deletedAt: null } }),
    prisma.firmTask.count({ where: { organizationId: orgId, status: { in: ["PENDING", "IN_PROGRESS"] } } }),
    prisma.firmTask.count({
      where: { organizationId: orgId, status: { not: "COMPLETED" }, dueDate: { lt: now } },
    }),
  ]);

  return NextResponse.json({
    workload: workloadData,
    summary: {
      totalCAs: caUsers.length,
      totalCustomers,
      pendingTasks: pendingAll,
      overdueTasks: overdueAll,
      overloadedCAs: workloadData.filter((w) => w.isOverloaded).length,
    },
  });
}
