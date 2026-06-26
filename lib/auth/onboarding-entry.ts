// ============================================================
// lib/auth/onboarding-entry.ts
//
// Automatic invitation resolution for null-role users — replaces the
// old manual "Join via CA Invitation" vs "Start Your Own Business"
// choice screen (/onboarding/welcome).
//
// autoProvision() (lib/auth/session.ts) already tries to resolve a
// pending Invitation/CustomerInvitation the FIRST time a Clerk user
// is provisioned. If no invite existed at that exact moment (timing
// race — the invite arrives slightly later), the user is left with
// userRole: null permanently, unless something re-checks. This module
// IS that re-check: it runs on every layout/page load by a null-role
// user, so the platform resolves the invitation automatically instead
// of asking the user to declare it.
//
// Resolution order:
//   1. Invitation (team-member / CA-firm-member invites, by email)
//   2. CustomerInvitation (firm → customer invites, by email)
//   3. Neither → self-signup role picker (/onboarding/role), unchanged
// ============================================================

import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { invalidateUserCache } from "@/lib/auth/session";
import { isOnboardingComplete } from "@/services/onboardingService";
import { findPendingCustomerInvite, finalizeCustomerInvitation } from "@/lib/customer-invitations/accept";
import { getInvitationType } from "@/lib/auth/invitation-type";
import type { UserRole } from "@prisma/client";

interface EntryUser {
  id: string;
  clerkId: string;
  email: string;
  name: string | null;
  phone: string | null;
  organizationId: string;
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

async function syncClerkRole(clerkId: string, userRole: UserRole): Promise<void> {
  try {
    const client = await clerkClient();
    await client.users.updateUser(clerkId, { publicMetadata: { userRole } });
  } catch (err) {
    console.error("[onboarding-entry] clerk metadata sync failed:", (err as Error).message);
  }
}

/**
 * Best-effort delete of the user's auto-provisioned solo org if it is
 * genuinely empty (no other users, no onboarding, no business data).
 * Mirrors the cleanup that used to run in the manual "Join via CA
 * Invitation" action.
 */
async function cleanupEmptyOrg(orgId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      onboardingCompleted: true,
      _count: { select: { users: true, customers: true, invoices: true } },
    },
  });
  if (!org) return;

  const safeToDelete =
    !org.onboardingCompleted &&
    org._count.users === 0 &&
    org._count.customers === 0 &&
    org._count.invoices === 0;

  if (safeToDelete) {
    await prisma.organization.delete({ where: { id: orgId } });
  }
}

/**
 * Re-checks for a pending `Invitation` row (team-member / CA-firm
 * invites) and, if found, claims and accepts it. Returns the role the
 * user was granted, or null if no claimable invite exists.
 *
 * Race-safe: claims the invite via `updateMany` + affected-row check
 * inside the transaction, so two concurrent requests (e.g. parallel
 * server-rendered layouts) can't both accept the same invite.
 */
async function tryAcceptPendingInvitation(user: EntryUser): Promise<UserRole | null> {
  if (!user.email) return null;

  const invite = await prisma.invitation.findFirst({
    where: {
      email: { equals: user.email, mode: "insensitive" },
      status: { in: ["PENDING", "SENT"] },
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!invite) return null;

  const targetUserRole: UserRole = invite.userRole ?? (invite.firmId ? "CA" : "CUSTOMER");
  const previousOrgId = user.organizationId;
  const alreadyInOrg = previousOrgId === invite.organizationId;

  const claimed = await prisma.$transaction(async (tx) => {
    // Race guard — only proceed if WE claim the invite right now.
    const claim = await tx.invitation.updateMany({
      where: { id: invite.id, status: { in: ["PENDING", "SENT"] } },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    if (claim.count !== 1) return false;

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
      // Move the membership: drop any membership in the old org, add
      // one in the inviter's org ("join, don't fork").
      await tx.membership.deleteMany({
        where: { userId: user.id, organizationId: previousOrgId },
      });
      await tx.membership.upsert({
        where: {
          userId_organizationId: { userId: user.id, organizationId: invite.organizationId },
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

    await tx.teamActivityLog.create({
      data: {
        organizationId: invite.organizationId,
        actorId: invite.invitedBy,
        targetUserId: user.id,
        targetEmail: user.email,
        action: "MEMBER_JOINED",
        module: "TEAM",
        metadata: {
          event: "invite_accepted",
          inviteId: invite.id,
          invitationType: getInvitationType({
            kind: "TEAM",
            firmId: invite.firmId,
            userRole: invite.userRole,
          }),
        },
      },
    });

    return true;
  });

  if (!claimed) return null;

  if (!alreadyInOrg) {
    await cleanupEmptyOrg(previousOrgId).catch((err) =>
      console.error("[onboarding-entry] cleanup skipped:", (err as Error).message)
    );
  }

  await syncClerkRole(user.clerkId, targetUserRole);
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

  return targetUserRole;
}

/**
 * Re-checks for a pending `CustomerInvitation` row and, if found,
 * finalizes it against the user's EXISTING organization (they already
 * have one from initial provisioning — no new org is created here,
 * unlike the autoProvision path). finalizeCustomerInvitation() is
 * idempotent, so re-running it on a later page load is safe.
 */
async function tryAcceptPendingCustomerInvite(user: EntryUser): Promise<boolean> {
  const invite = await findPendingCustomerInvite(user.email);
  if (!invite) return false;

  await finalizeCustomerInvitation({
    invite,
    userName: user.name,
    organizationId: user.organizationId,
  });

  const targetUserRole: UserRole = "CUSTOMER";

  await prisma.user.update({
    where: { id: user.id },
    data: { userRole: targetUserRole },
  });

  await syncClerkRole(user.clerkId, targetUserRole);
  await invalidateUserCache(user.clerkId);

  return true;
}

/**
 * Single entry point for layouts/pages to call when `user.userRole`
 * is null. Always returns a redirect target — never throws for "no
 * invite found" (that's just the self-signup fallback).
 */
export async function resolveOnboardingEntry(user: EntryUser): Promise<{ redirectTo: string }> {
  const viaInvitation = await tryAcceptPendingInvitation(user);
  if (viaInvitation) return { redirectTo: portalFor(viaInvitation) };

  const viaCustomerInvite = await tryAcceptPendingCustomerInvite(user);
  if (viaCustomerInvite) {
    const done = await isOnboardingComplete(user.organizationId);
    return { redirectTo: done ? "/dashboard" : "/onboarding/customer" };
  }

  return { redirectTo: "/onboarding/role" };
}
