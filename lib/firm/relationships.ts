// ============================================================
// lib/firm/relationships.ts
//
// Read-model for the Relationships page (CA CRM). One function for
// the CA directory, one for a single CA's full 360° detail.
// ============================================================

import { prisma } from "@/lib/prisma";

export interface CaDirectoryItem {
  id: string;
  name: string;
  email: string;
  firmRole: string | null;
  customerCount: number;
}

export interface CaPortfolioCustomer {
  id: string;
  name: string;
  company: string | null;
  openTasks: number;
}

export interface CaTaskItem {
  id: string;
  title: string;
  customerName: string;
  status: string;
  priority: string;
  dueDate: string;
  completedAt: string | null;
}

export interface CaTimelineItem {
  id: string;
  action: string;
  actorName: string | null;
  targetEmail: string | null;
  createdAt: string;
}

export interface CaDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  firmRole: string | null;
  joiningDate: string | null;
  isActive: boolean;
  avatarUrl: string | null;
  metrics: {
    customersAssigned: number;
    tasksCompleted: number;
    tasksPending: number;
    tasksOverdue: number;
  };
  portfolio: CaPortfolioCustomer[];
  openTasks: CaTaskItem[];
  completedTasks: CaTaskItem[];
  timeline: CaTimelineItem[];
}

export async function getCaDirectory(organizationId: string): Promise<CaDirectoryItem[]> {
  const cas = await prisma.user.findMany({
    where: { organizationId, userRole: { in: ["CA", "CA_FIRM_ADMIN"] } },
    select: {
      id: true,
      name: true,
      email: true,
      firmRole: true,
      isActive: true,
      _count: { select: { customerAssignments: { where: { isActive: true } } } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return cas.map((c) => ({
    id: c.id,
    name: c.name ?? c.email,
    email: c.email,
    firmRole: c.firmRole,
    customerCount: c._count.customerAssignments,
  }));
}

export async function getCaDetail(organizationId: string, caId: string): Promise<CaDetail | null> {
  const now = new Date();

  const user = await prisma.user.findFirst({
    where: { id: caId, organizationId, userRole: { in: ["CA", "CA_FIRM_ADMIN"] } },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      firmRole: true,
      joiningDate: true,
      isActive: true,
      avatarUrl: true,
    },
  });
  if (!user) return null;

  const [
    customersAssigned,
    tasksCompleted,
    tasksPending,
    tasksOverdue,
    assignments,
    openTasks,
    completedTasks,
    timeline,
  ] = await Promise.all([
    prisma.customerAssignment.count({ where: { caId, isActive: true } }),
    prisma.firmTask.count({ where: { organizationId, assignedCaId: caId, status: "COMPLETED" } }),
    prisma.firmTask.count({ where: { organizationId, assignedCaId: caId, status: { not: "COMPLETED" } } }),
    prisma.firmTask.count({
      where: { organizationId, assignedCaId: caId, status: { not: "COMPLETED" }, dueDate: { lt: now } },
    }),
    prisma.customerAssignment.findMany({
      where: { caId, isActive: true, customer: { organizationId, deletedAt: null } },
      select: {
        customer: {
          select: {
            id: true,
            name: true,
            company: true,
            _count: { select: { firmTasks: { where: { status: { not: "COMPLETED" } } } } },
          },
        },
      },
      orderBy: { assignedAt: "desc" },
      take: 60,
    }),
    prisma.firmTask.findMany({
      where: { organizationId, assignedCaId: caId, status: { not: "COMPLETED" } },
      include: { customer: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 25,
    }),
    prisma.firmTask.findMany({
      where: { organizationId, assignedCaId: caId, status: "COMPLETED" },
      include: { customer: { select: { name: true } } },
      orderBy: { completedAt: "desc" },
      take: 25,
    }),
    prisma.teamActivityLog.findMany({
      where: { organizationId, OR: [{ targetUserId: caId }, { actorId: caId }] },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  const mapTask = (t: {
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: Date;
    completedAt: Date | null;
    customer: { name: string };
  }): CaTaskItem => ({
    id: t.id,
    title: t.title,
    customerName: t.customer.name,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate.toISOString(),
    completedAt: t.completedAt?.toISOString() ?? null,
  });

  return {
    id: user.id,
    name: user.name ?? user.email,
    email: user.email,
    phone: user.phone,
    firmRole: user.firmRole,
    joiningDate: user.joiningDate?.toISOString() ?? null,
    isActive: user.isActive,
    avatarUrl: user.avatarUrl,
    metrics: { customersAssigned, tasksCompleted, tasksPending, tasksOverdue },
    portfolio: assignments.map((a) => ({
      id: a.customer.id,
      name: a.customer.name,
      company: a.customer.company,
      openTasks: a.customer._count.firmTasks,
    })),
    openTasks: openTasks.map(mapTask),
    completedTasks: completedTasks.map(mapTask),
    timeline: timeline.map((t) => ({
      id: t.id,
      action: t.action,
      actorName: t.actorName,
      targetEmail: t.targetEmail,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}
