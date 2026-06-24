// ============================================================
// lib/ca/portal.ts
//
// Core data layer for the customer-centric CA portal. Everything is
// scoped to the customers a CA is actively assigned to via
// CustomerAssignment (caId). The CRM Customer is the unit of work;
// its onboarded Organization (the "bridge") unlocks compliance,
// banking and workspace data.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { Customer } from "@prisma/client";

// ---------------------------------------------------------------------------
// Customer → Organization bridge
// A CRM customer only has compliance/banking/workspace data through the org
// it was provisioned on accepting its onboarding invite.
// ---------------------------------------------------------------------------
export async function resolveCustomerOrgId(customerId: string): Promise<string | null> {
  const inv = await prisma.customerInvitation.findFirst({
    where: { customerId, acceptedOrganizationId: { not: null } },
    orderBy: { acceptedAt: "desc" },
    select: { acceptedOrganizationId: true },
  });
  return inv?.acceptedOrganizationId ?? null;
}

export async function resolveCustomerOrgIds(
  customerIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (customerIds.length === 0) return map;
  const invs = await prisma.customerInvitation.findMany({
    where: { customerId: { in: customerIds }, acceptedOrganizationId: { not: null } },
    orderBy: { acceptedAt: "desc" },
    select: { customerId: true, acceptedOrganizationId: true },
  });
  for (const i of invs) {
    if (i.customerId && i.acceptedOrganizationId && !map.has(i.customerId)) {
      map.set(i.customerId, i.acceptedOrganizationId);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Scoping guard — a CA may only ever touch their assigned customers
// ---------------------------------------------------------------------------
export async function isCustomerAssignedTo(
  caUserId: string,
  customerId: string
): Promise<boolean> {
  const a = await prisma.customerAssignment.findFirst({
    where: { caId: caUserId, customerId, isActive: true },
    select: { id: true },
  });
  return !!a;
}

// ---------------------------------------------------------------------------
// Assigned client portfolio (My Clients + dashboard aggregates)
// ---------------------------------------------------------------------------
export interface AssignedClient {
  assignmentId: string;
  assignedAt: Date;
  customer: Customer;
  organizationId: string | null;
  onboarded: boolean;
  taskCounts: { total: number; open: number; overdue: number };
  complianceCounts: { total: number; overdue: number; completed: number; dueSoon: number };
  checklistCounts: { total: number; uploaded: number; missing: number; pending: number };
  awaitingDocs: number;
  healthScore: number;
  complianceScore: number;
  lastActivityAt: Date | null;
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

export async function getAssignedCustomers(caUserId: string): Promise<AssignedClient[]> {
  const assignments = await prisma.customerAssignment.findMany({
    where: { caId: caUserId, isActive: true },
    include: { customer: true },
    orderBy: { assignedAt: "desc" },
  });
  if (assignments.length === 0) return [];

  const customerIds = assignments.map((a) => a.customerId);
  const now = new Date();
  const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [tasks, calendar, checklists, invitations] = await Promise.all([
    prisma.firmTask.findMany({
      where: { customerId: { in: customerIds }, assignedCaId: caUserId },
      select: { customerId: true, status: true, dueDate: true, updatedAt: true },
    }),
    prisma.complianceCalendarEntry.findMany({
      where: { customerId: { in: customerIds } },
      select: { customerId: true, status: true, dueDate: true, completedAt: true, updatedAt: true },
    }),
    prisma.clientChecklist.findMany({
      where: { customerId: { in: customerIds } },
      select: { customerId: true, items: { select: { status: true } } },
    }),
    prisma.customerInvitation.findMany({
      where: { customerId: { in: customerIds } },
      orderBy: { createdAt: "desc" },
      select: { customerId: true, completedAt: true, acceptedOrganizationId: true, updatedAt: true },
    }),
  ]);

  // Index by customer.
  const byCustomer = <T extends { customerId: string | null }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      if (!r.customerId) continue;
      const arr = m.get(r.customerId) ?? [];
      arr.push(r);
      m.set(r.customerId, arr);
    }
    return m;
  };
  const tasksBy = byCustomer(tasks);
  const calBy = byCustomer(calendar);
  const checklistBy = new Map(checklists.map((c) => [c.customerId, c.items]));
  const invBy = byCustomer(invitations);

  return assignments.map((a) => {
    const cid = a.customerId;
    const t = tasksBy.get(cid) ?? [];
    const c = calBy.get(cid) ?? [];
    const items = checklistBy.get(cid) ?? [];
    const invs = invBy.get(cid) ?? [];

    const openTasks = t.filter((x) => x.status !== "COMPLETED");
    const overdueTasks = openTasks.filter((x) => x.dueDate && x.dueDate < now);

    const overdueCompliance = c.filter(
      (x) => x.status === "OVERDUE" || (x.status !== "COMPLETED" && x.dueDate < now)
    );
    const completedCompliance = c.filter((x) => x.status === "COMPLETED");
    const dueSoonCompliance = c.filter(
      (x) => x.status !== "COMPLETED" && x.dueDate >= now && x.dueDate <= soon
    );

    const missingDocs = items.filter((i) => i.status === "MISSING").length;
    const expiredDocs = items.filter((i) => i.status === "EXPIRED").length;
    const pendingDocs = items.filter((i) => i.status === "PENDING_REVIEW").length;
    const uploadedDocs = items.filter((i) => i.status === "UPLOADED").length;

    const orgId = invs.find((i) => i.acceptedOrganizationId)?.acceptedOrganizationId ?? null;
    const onboarded = invs.some((i) => i.completedAt) || !!orgId;

    const healthScore = clamp(
      100 - overdueTasks.length * 10 - overdueCompliance.length * 12 - (missingDocs + expiredDocs) * 5
    );
    const complianceScore =
      c.length === 0
        ? 100
        : clamp(Math.round((completedCompliance.length / c.length) * 100) - overdueCompliance.length * 10);

    const activityDates = [
      a.customer.updatedAt,
      ...t.map((x) => x.updatedAt),
      ...c.map((x) => x.updatedAt),
      ...invs.map((x) => x.updatedAt),
    ].filter(Boolean) as Date[];
    const lastActivityAt =
      activityDates.length > 0
        ? new Date(Math.max(...activityDates.map((d) => d.getTime())))
        : null;

    return {
      assignmentId: a.id,
      assignedAt: a.assignedAt,
      customer: a.customer,
      organizationId: orgId,
      onboarded,
      taskCounts: { total: t.length, open: openTasks.length, overdue: overdueTasks.length },
      complianceCounts: {
        total: c.length,
        overdue: overdueCompliance.length,
        completed: completedCompliance.length,
        dueSoon: dueSoonCompliance.length,
      },
      checklistCounts: {
        total: items.length,
        uploaded: uploadedDocs,
        missing: missingDocs + expiredDocs,
        pending: pendingDocs,
      },
      awaitingDocs: missingDocs + expiredDocs + pendingDocs,
      healthScore,
      complianceScore,
      lastActivityAt,
    };
  });
}

export function healthLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 90) return { label: "Healthy", color: "#10b981", bg: "rgba(16,185,129,0.1)" };
  if (score >= 70) return { label: "Minor Issues", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" };
  if (score >= 50) return { label: "Attention", color: "#f97316", bg: "rgba(249,115,22,0.1)" };
  if (score >= 30) return { label: "At Risk", color: "#ef4444", bg: "rgba(239,68,68,0.1)" };
  return { label: "Critical", color: "#dc2626", bg: "rgba(220,38,38,0.1)" };
}

// ---------------------------------------------------------------------------
// Onboarding funnel (dashboard) — invitations the CA owns
// ---------------------------------------------------------------------------
export async function getOnboardingFunnel(caUserId: string) {
  const invites = await prisma.customerInvitation.findMany({
    where: { OR: [{ assignedCaId: caUserId }, { invitedById: caUserId }] },
    select: {
      status: true,
      sentAt: true,
      emailOpenedAt: true,
      acceptedAt: true,
      completedAt: true,
    },
  });
  return {
    sent: invites.filter((i) => i.sentAt || i.status !== "PENDING").length,
    viewed: invites.filter((i) => i.emailOpenedAt).length,
    accepted: invites.filter((i) => i.acceptedAt || i.status === "ACCEPTED").length,
    completed: invites.filter((i) => i.completedAt).length,
    total: invites.length,
  };
}

// ---------------------------------------------------------------------------
// Recent activity (dashboard) — impersonation + task activity by this CA
// ---------------------------------------------------------------------------
export async function getRecentActivity(caUserId: string, limit = 8) {
  return prisma.clientActivityLog.findMany({
    where: { caUserId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, action: true, summary: true, createdAt: true, organizationId: true },
  });
}
