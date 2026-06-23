"use server";

// ============================================================
// actions/accept-invitation.ts
//
// "Join via CA Invitation" for an ALREADY signed-in user. A brand-new
// invited user is normally provisioned straight into the inviter's org
// at sign-up (lib/auth/invitations.ts joinOrganizationFromInvite). This
// action is the explicit entry point + the late-invite fallback: it
// moves the current user INTO the invitation's organization as a member
// with the invited role — never creating a new org — and best-effort
// cleans up the empty solo org auto-created at sign-up.
//
// Honours the invariant: an invited user must never have a separate org.
// ============================================================

import { clerkClient } from "@clerk/nextjs/server";
import { getCurrentUser, invalidateUserCache } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import type { UserRole } from "@prisma/client";

export interface AcceptInvitationResult {
  success: boolean;
  redirectTo?: string;
  error?: string;
}

function portalFor(role: UserRole): string {
  switch (role) {
    case "CA_FIRM_ADMIN":
      return "/firm";
    case "CA":
      return "/ca";
    case "ADMIN":
      return "/admin";
    default:
      return "/dashboard";
  }
}

export async function actionAcceptInvitationForCurrentUser(): Promise<AcceptInvitationResult> {
  try {
    const user = await getCurrentUser();
    if (!user.email) {
      return { success: false, error: "Your account has no email to match an invitation." };
    }

    const invite = await prisma.invitation.findFirst({
      where: {
        email: { equals: user.email, mode: "insensitive" },
        // PENDING = created; SENT = email dispatched. Both joinable.
        status: { in: ["PENDING", "SENT"] },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!invite) {
      return {
        success: false,
        error: `No pending invitation found for ${user.email}. Ask your CA to invite this email, then try again.`,
      };
    }

    const targetUserRole: UserRole =
      invite.userRole ?? (invite.firmId ? "CA" : "CUSTOMER");
    const previousOrgId = user.organizationId;
    const alreadyInOrg = previousOrgId === invite.organizationId;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          organizationId: invite.organizationId,
          role: invite.role,
          userRole: targetUserRole,
          firmId: invite.firmId,
          firmRole: invite.firmRole,
          specialization: invite.specialization,
          joiningDate: invite.joiningDate ?? new Date(),
          name: invite.name ?? user.name,
          phone: invite.phone ?? user.phone,
        },
      });

      if (!alreadyInOrg) {
        // Move the membership: drop any membership in the old org, add one
        // in the inviter's org (the core "join, don't fork" invariant).
        await tx.membership.deleteMany({
          where: { userId: user.id, organizationId: previousOrgId },
        });
        await tx.membership.upsert({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: invite.organizationId,
            },
          },
          create: {
            userId: user.id,
            organizationId: invite.organizationId,
            role: invite.role,
            invitedBy: invite.invitedBy,
          },
          update: { role: invite.role },
        });
      }

      await tx.invitation.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });

      await tx.teamActivityLog.create({
        data: {
          organizationId: invite.organizationId,
          actorId: invite.invitedBy,
          targetUserId: user.id,
          targetEmail: user.email,
          action: "MEMBER_JOINED",
          module: "TEAM",
          metadata: { event: "invite_accepted", inviteId: invite.id },
        },
      });
    });

    // Best-effort: remove the now-empty solo org auto-created at sign-up.
    if (!alreadyInOrg) {
      await cleanupEmptyOrg(previousOrgId, user.id).catch((err) =>
        console.error("[accept-invitation] cleanup skipped:", (err as Error).message)
      );
    }

    // Sync Clerk publicMetadata so the JWT reflects the joined role.
    try {
      const client = await clerkClient();
      await client.users.updateUser(user.clerkId, {
        publicMetadata: { userRole: targetUserRole },
      });
    } catch (err) {
      console.error("[accept-invitation] clerk metadata sync failed:", (err as Error).message);
    }

    await invalidateUserCache(user.clerkId);

    await createAuditLog({
      organizationId: invite.organizationId,
      userId: invite.invitedBy ?? undefined,
      action: "CREATE",
      entity: "membership",
      entityId: user.id,
      description: `${user.email} accepted invitation and joined as ${invite.role}`,
      newValue: { email: user.email, role: invite.role },
    });

    return { success: true, redirectTo: portalFor(targetUserRole) };
  } catch (err) {
    console.error("[actionAcceptInvitationForCurrentUser]", err);
    return { success: false, error: "Failed to accept the invitation. Please try again." };
  }
}

/**
 * Delete the user's auto-provisioned solo org if it is genuinely empty:
 * no other users, no onboarding completed, and no business data. This
 * keeps the join clean without risking any real tenant. Best-effort.
 */
async function cleanupEmptyOrg(orgId: string, movedUserId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      onboardingCompleted: true,
      _count: {
        select: { users: true, customers: true, invoices: true },
      },
    },
  });
  if (!org) return;

  const safeToDelete =
    !org.onboardingCompleted &&
    org._count.users === 0 && // the only user was just moved out
    org._count.customers === 0 &&
    org._count.invoices === 0;

  if (safeToDelete) {
    await prisma.organization.delete({ where: { id: orgId } });
  } else {
    void movedUserId; // retained for clarity; not needed beyond the guard
  }
}
