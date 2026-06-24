// ============================================================
// lib/auth/invitations.ts
//
// Shared invite-acceptance logic. A user must NEVER create a
// separate organization when there is a pending invitation for
// their email — they must join the inviter's organization with the
// invited role.
//
// This helper is the single implementation used by BOTH entry points
// that provision a brand-new Clerk user:
//   • app/api/webhooks/clerk/route.ts  (Clerk user.created webhook)
//   • lib/auth/session.ts autoProvision (fallback when the webhook is
//     delayed or missed — common in local dev / webhook downtime)
//
// Keeping them in sync here is what guarantees the "join, don't fork"
// invariant regardless of which path runs first.
// ============================================================

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import type { Prisma, PrismaClient } from "@prisma/client";

export interface JoinInviteParams {
  clerkId: string;
  email: string;
  /** Display name from Clerk (overridden by the invite's name when present). */
  name: string;
  avatarUrl?: string | null;
  phone?: string | null;
}

// The full user payload session.ts caches — include the org so the
// caller can prime its caches without a second round-trip.
const USER_INCLUDE = {
  organization: { include: { businessProfile: true } },
} satisfies Prisma.UserInclude;

export type JoinedUser = Prisma.UserGetPayload<{ include: typeof USER_INCLUDE }>;

/**
 * If a PENDING, non-expired invitation exists for `email`, provision
 * the user INTO that invitation's organization with the invited role,
 * create their Membership, mark the invite ACCEPTED, and write an
 * audit-trail entry. All in a single transaction.
 *
 * Returns the joined user (with organization included) or `null` when
 * there is no applicable invite (caller then falls back to creating a
 * fresh organization).
 *
 * Duplicate-acceptance is prevented by:
 *   • the `clerkId` unique constraint (one User row per Clerk user), and
 *   • the `status: "PENDING"` filter (an ACCEPTED invite is skipped).
 */
export async function joinOrganizationFromInvite(
  { clerkId, email, name, avatarUrl, phone }: JoinInviteParams,
  client: PrismaClient = prisma
): Promise<JoinedUser | null> {
  if (!email) return null;

  const pendingInvite = await client.invitation.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      // PENDING = created; SENT = email dispatched. Both are acceptable —
      // an invite the firm emailed must still let the invitee join.
      status: { in: ["PENDING", "SENT"] },
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!pendingInvite) return null;

  const user = await client.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        clerkId,
        email,
        name: pendingInvite.name ?? name,
        // Platform-level RBAC role (OWNER..VIEWER) carried by the invite.
        role: pendingInvite.role,
        // Which portal the user enters. Dashboard invites set CUSTOMER;
        // firm invites carry CA / CA_FIRM_ADMIN. Fall back sensibly.
        userRole:
          pendingInvite.userRole ?? (pendingInvite.firmId ? "CA" : "CUSTOMER"),
        avatarUrl: avatarUrl ?? null,
        phone: pendingInvite.phone ?? phone ?? null,
        isActive: true,
        // ── Join the inviter's organization — the core invariant ──
        organizationId: pendingInvite.organizationId,
        // Firm team-member profile (null for dashboard invites)
        firmId: pendingInvite.firmId,
        firmRole: pendingInvite.firmRole,
        specialization: pendingInvite.specialization,
        joiningDate: pendingInvite.joiningDate ?? new Date(),
        // Firm-level capability flags + reporting manager (Add-CA wizard)
        firmPermissions: pendingInvite.firmPermissions,
        managerId: pendingInvite.managerId,
      },
      include: USER_INCLUDE,
    });

    await tx.membership.create({
      data: {
        userId: user.id,
        organizationId: pendingInvite.organizationId,
        role: pendingInvite.role,
        invitedBy: pendingInvite.invitedBy,
      },
    });

    await tx.invitation.update({
      where: { id: pendingInvite.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });

    await tx.teamActivityLog.create({
      data: {
        organizationId: pendingInvite.organizationId,
        actorId: pendingInvite.invitedBy,
        targetUserId: user.id,
        targetEmail: email,
        action: "MEMBER_JOINED",
        module: "TEAM",
        metadata: { event: "invite_accepted", inviteId: pendingInvite.id },
      },
    });

    return user;
  });

  // Audit trail (compliance) — written after the join commits.
  await createAuditLog({
    organizationId: pendingInvite.organizationId,
    userId: pendingInvite.invitedBy ?? undefined,
    action: "CREATE",
    entity: "membership",
    entityId: user.id,
    description: `${email} accepted invitation and joined as ${pendingInvite.role}`,
    newValue: { email, role: pendingInvite.role },
  });

  return user;
}
