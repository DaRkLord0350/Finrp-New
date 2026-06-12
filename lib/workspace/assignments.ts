// ============================================================
// lib/workspace/assignments.ts
//
// ClientAssignment repository + workspace access resolution.
//
// Access rules (requirement: middleware protection):
//   • ADMIN          → super admin, can open ANY client org
//   • CA             → only orgs with an active ClientAssignment
//   • CA_FIRM_ADMIN  → own assignments + any active assignment
//                      belonging to their firm (firmId match)
//   • CUSTOMER       → never
//
// resolveWorkspaceAccess() runs on EVERY impersonated request via
// getWorkspaceContext(), so the verdict is cached in Redis for a
// short TTL. Assignment mutations invalidate the cache.
// ============================================================

import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet, cacheDelPattern } from "@/lib/cache";
import { WORKSPACE_PERMISSIONS } from "./permissions";
import type { ClientPermission, UserRole } from "@prisma/client";

const ACCESS_TTL = 60; // seconds — short so revocations take effect fast

const accessKey = (userId: string, orgId: string) =>
  `finrp:ws:access:${userId}:${orgId}`;

export interface WorkspaceAccess {
  allowed: boolean;
  permissions: ClientPermission[];
  assignmentId: string | null;
}

const DENIED: WorkspaceAccess = { allowed: false, permissions: [], assignmentId: null };

interface AccessUser {
  id: string;
  userRole: UserRole | null;
  firmId: string | null;
}

/**
 * Resolves whether `user` may operate inside `organizationId`'s
 * workspace and with which permission set. Redis-cached.
 */
export async function resolveWorkspaceAccess(
  user: AccessUser,
  organizationId: string
): Promise<WorkspaceAccess> {
  if (!user.userRole || user.userRole === "CUSTOMER") return DENIED;

  // Super admin — full access to every client, all permissions.
  if (user.userRole === "ADMIN") {
    return { allowed: true, permissions: [...WORKSPACE_PERMISSIONS], assignmentId: null };
  }

  const key = accessKey(user.id, organizationId);
  const cached = await cacheGet<WorkspaceAccess>(key);
  if (cached) return cached;

  // Own active assignment first (applies to CA and CA_FIRM_ADMIN).
  let assignment = await prisma.clientAssignment.findFirst({
    where: { caUserId: user.id, organizationId, isActive: true },
    select: { id: true, permissions: true },
  });

  // Firm admins may open any client assigned to their firm.
  if (!assignment && user.userRole === "CA_FIRM_ADMIN" && user.firmId) {
    assignment = await prisma.clientAssignment.findFirst({
      where: { firmId: user.firmId, organizationId, isActive: true },
      select: { id: true, permissions: true },
    });
  }

  const access: WorkspaceAccess = assignment
    ? { allowed: true, permissions: assignment.permissions, assignmentId: assignment.id }
    : DENIED;

  await cacheSet(key, access, ACCESS_TTL);
  return access;
}

/**
 * Invalidate cached access verdicts for an org (all CAs) after an
 * assignment is created / updated / revoked.
 */
export async function invalidateWorkspaceAccess(organizationId: string): Promise<void> {
  await cacheDelPattern(`finrp:ws:access:*:${organizationId}`);
}

// ---------------------------------------------------------------------------
// Listing helpers
// ---------------------------------------------------------------------------

const clientOrgSelect = {
  id: true,
  name: true,
  slug: true,
  plan: true,
  onboardingCompleted: true,
  businessProfile: {
    select: { businessName: true, businessType: true, gstin: true, pan: true, contactEmail: true, phone: true },
  },
} as const;

/**
 * Organizations the user can open a workspace for.
 *   ADMIN          → every customer organization
 *   CA_FIRM_ADMIN  → all active assignments of their firm
 *   CA             → their own active assignments
 */
export async function listOpenableClients(user: AccessUser) {
  if (user.userRole === "ADMIN") {
    const orgs = await prisma.organization.findMany({
      where: { users: { some: { userRole: "CUSTOMER" } } },
      select: clientOrgSelect,
      orderBy: { name: "asc" },
      take: 200,
    });
    return orgs.map((org) => ({
      organization: org,
      assignmentId: null as string | null,
      permissions: [...WORKSPACE_PERMISSIONS] as ClientPermission[],
      assignedAt: null as Date | null,
    }));
  }

  const where =
    user.userRole === "CA_FIRM_ADMIN" && user.firmId
      ? {
          isActive: true,
          OR: [{ caUserId: user.id }, { firmId: user.firmId }],
        }
      : { isActive: true, caUserId: user.id };

  const assignments = await prisma.clientAssignment.findMany({
    where,
    include: { organization: { select: clientOrgSelect } },
    orderBy: { assignedAt: "desc" },
  });

  // A firm admin can see the same org via own + firm assignments — dedupe.
  const seen = new Set<string>();
  const result = [];
  for (const a of assignments) {
    if (seen.has(a.organizationId)) continue;
    seen.add(a.organizationId);
    result.push({
      organization: a.organization,
      assignmentId: a.id,
      permissions: a.permissions,
      assignedAt: a.assignedAt,
    });
  }
  return result;
}
