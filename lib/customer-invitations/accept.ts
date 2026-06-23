// ============================================================
// lib/customer-invitations/accept.ts
//
// Customer-invitation acceptance. Mirrors the "join, don't fork"
// invariant of lib/auth/invitations.ts, but for CUSTOMER invites the
// invitee gets their OWN organization (a separate tenant) — the firm
// only holds a CRM Customer record + assignments pointing at it.
//
// Called from BOTH provisioning entry points (Clerk webhook +
// session.autoProvision) AFTER the customer's org + User have been
// created, so the link lands no matter which path runs first.
//
// finalizeCustomerInvitation() is idempotent: re-running it for an
// already-accepted invite is a no-op, and the assignment writes upsert.
// ============================================================

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { invalidateWorkspaceAccess } from "@/lib/workspace/assignments";
import { recordClientActivity } from "@/lib/workspace/audit";
import { notifyAssignment } from "@/lib/notifications";
import type { CustomerInvitation } from "@prisma/client";

/**
 * Active (PENDING|SENT, non-expired) customer invitation for an email.
 * Returns null when there is none — caller then provisions a normal org.
 */
export async function findPendingCustomerInvite(
  email: string
): Promise<CustomerInvitation | null> {
  if (!email) return null;
  return prisma.customerInvitation.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      status: { in: ["PENDING", "SENT"] },
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
}

interface FinalizeParams {
  invite: CustomerInvitation;
  /** Display name of the freshly-created customer (fallback for CRM name). */
  userName: string | null;
  /** The customer's OWN organization id (their tenant). */
  organizationId: string;
}

/**
 * Wire an accepted customer invite into the firm:
 *   1. Ensure a CRM Customer record in the firm's org.
 *   2. CustomerAssignment   (CRM record ↔ owning CA).
 *   3. ClientAssignment     (CA ↔ customer org, enables impersonation).
 *   4. Mark the invite ACCEPTED + stamp the accepted org.
 *
 * All firm-side writes run in one transaction. Audit / cache / notify
 * happen after commit and never block the signup.
 */
export async function finalizeCustomerInvitation({
  invite,
  userName,
  organizationId,
}: FinalizeParams): Promise<void> {
  // Already accepted (e.g. webhook + autoProvision both fired) — no-op.
  if (invite.status === "ACCEPTED") return;

  const caId = invite.assignedCaId ?? invite.invitedById;

  const result = await prisma.$transaction(async (tx) => {
    // ── 1. CRM Customer record in the firm's org ──────────────────
    let customerId = invite.customerId;
    if (customerId) {
      const existing = await tx.customer.findFirst({
        where: { id: customerId, organizationId: invite.organizationId },
        select: { id: true },
      });
      if (!existing) customerId = null;
    }
    if (!customerId) {
      const customer = await tx.customer.create({
        data: {
          name: invite.name ?? userName ?? invite.email,
          email: invite.email,
          phone: invite.phone,
          company: invite.company,
          customerType: "BUSINESS",
          organizationId: invite.organizationId,
          firmId: invite.firmId,
          notes: "Onboarded via customer invitation",
        },
        select: { id: true },
      });
      customerId = customer.id;
    }

    // ── 2. CustomerAssignment (CRM record ↔ owning CA) ────────────
    const existingAssignment = await tx.customerAssignment.findFirst({
      where: { customerId, caId, isActive: true },
      select: { id: true },
    });
    if (!existingAssignment) {
      await tx.customerAssignment.create({
        data: {
          customerId,
          caId,
          assignedById: invite.invitedById,
          isActive: true,
          reason: "Customer onboarding invitation",
        },
      });
    }

    // ── 3. ClientAssignment (CA ↔ customer org → impersonation) ───
    await tx.clientAssignment.upsert({
      where: {
        caUserId_organizationId: { caUserId: caId, organizationId },
      },
      create: {
        caUserId: caId,
        organizationId,
        firmId: invite.firmId,
        assignedById: invite.invitedById,
        notes: "Auto-assigned from customer onboarding invitation",
      },
      update: {
        isActive: true,
        revokedAt: null,
        assignedById: invite.invitedById,
        assignedAt: new Date(),
      },
    });

    // ── 4. Mark the invite accepted ───────────────────────────────
    await tx.customerInvitation.update({
      where: { id: invite.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        acceptedOrganizationId: organizationId,
        customerId,
      },
    });

    return { customerId };
  });

  // ── Post-commit: cache invalidation, audit, notify (best-effort) ─
  await invalidateWorkspaceAccess(organizationId);

  await recordClientActivity({
    caUserId: caId,
    organizationId,
    action: "ASSIGNMENT_CREATED",
    summary: `Customer "${invite.name ?? invite.email}" accepted their invitation and was onboarded`,
    entity: "customerInvitation",
    entityId: invite.id,
    metadata: { customerId: result.customerId, email: invite.email },
  });

  await createAuditLog({
    organizationId: invite.organizationId,
    userId: invite.invitedById,
    action: "CREATE",
    entity: "customerInvitation",
    entityId: invite.id,
    description: `${invite.email} accepted customer invitation and onboarded`,
    newValue: { customerId: result.customerId, organizationId },
  });

  // Tell the owning CA a new client is live (respects firm notif settings).
  try {
    const [ca, org] = await Promise.all([
      prisma.user.findUnique({
        where: { id: caId },
        select: { name: true, email: true, phone: true },
      }),
      prisma.organization.findUnique({
        where: { id: invite.organizationId },
        select: { name: true, businessProfile: { select: { businessName: true } } },
      }),
    ]);
    if (ca?.email) {
      await notifyAssignment({
        organizationId: invite.organizationId,
        caEmail: ca.email,
        caPhone: ca.phone ?? undefined,
        caName: ca.name ?? ca.email,
        customerName: invite.name ?? invite.email,
        firmName: org?.businessProfile?.businessName ?? org?.name ?? "your firm",
      });
    }
  } catch (err) {
    console.error("[customer-invite] post-accept notify failed:", err);
  }
}
