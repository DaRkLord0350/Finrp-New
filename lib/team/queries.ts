// ============================================================
// lib/team/queries.ts
//
// Roster read model shared by the Team page (SSR) and the GET
// /api/firm/team refresh endpoint, so both render identical data.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { TeamMember, ActivityEntry } from "@/components/firm/team/types";

export interface TeamRoster {
  members: TeamMember[];
  invites: TeamMember[];
  activity: ActivityEntry[];
}

export async function getTeamRoster(organizationId: string): Promise<TeamRoster> {
  const [users, invites, activity] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId, userRole: { in: ["CA", "CA_FIRM_ADMIN"] } },
      include: {
        _count: {
          select: {
            customerAssignments: { where: { isActive: true } },
            firmTasksAsCa: { where: { status: { not: "COMPLETED" } } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { organizationId, status: { in: ["PENDING", "SENT", "EXPIRED"] } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.teamActivityLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const now = new Date();

  const members: TeamMember[] = users.map((u) => ({
    id: u.id,
    kind: "user",
    name: u.name,
    email: u.email,
    phone: u.phone,
    avatarUrl: u.avatarUrl,
    firmRole: u.firmRole,
    specialization: u.specialization,
    userRole: u.userRole,
    joiningDate: u.joiningDate ? u.joiningDate.toISOString() : null,
    isActive: u.isActive,
    status: u.isActive ? "ACTIVE" : "INACTIVE",
    customerCount: u._count.customerAssignments,
    openTaskCount: u._count.firmTasksAsCa,
    defaultPermissions: u.defaultPermissions,
    createdAt: u.createdAt.toISOString(),
    expiresAt: null,
  }));

  const inviteRows: TeamMember[] = invites.map((inv) => ({
    id: inv.id,
    kind: "invite",
    name: inv.name,
    email: inv.email,
    phone: inv.phone,
    avatarUrl: null,
    firmRole: inv.firmRole,
    specialization: inv.specialization,
    userRole: inv.userRole,
    joiningDate: inv.joiningDate ? inv.joiningDate.toISOString() : null,
    isActive: inv.status === "PENDING" || inv.status === "SENT",
    status:
      (inv.status === "PENDING" || inv.status === "SENT") && inv.expiresAt < now
        ? "EXPIRED"
        : inv.status,
    customerCount: 0,
    openTaskCount: 0,
    defaultPermissions: [],
    createdAt: inv.createdAt.toISOString(),
    expiresAt: inv.expiresAt.toISOString(),
  }));

  const activityRows: ActivityEntry[] = activity.map((a) => ({
    id: a.id,
    action: a.action,
    actorName: a.actorName,
    targetEmail: a.targetEmail,
    metadata: (a.metadata as Record<string, unknown> | null) ?? null,
    createdAt: a.createdAt.toISOString(),
  }));

  return { members, invites: inviteRows, activity: activityRows };
}

/** Lower-cased set of every email already in the firm (users + pending invites). */
export async function getExistingFirmEmails(organizationId: string): Promise<Set<string>> {
  const [users, invites] = await Promise.all([
    prisma.user.findMany({ where: { organizationId }, select: { email: true } }),
    prisma.invitation.findMany({
      where: { organizationId, status: "PENDING" },
      select: { email: true },
    }),
  ]);
  return new Set([...users, ...invites].map((x) => x.email.toLowerCase()));
}
