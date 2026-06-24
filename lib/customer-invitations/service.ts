// ============================================================
// lib/customer-invitations/service.ts
//
// Customer onboarding invitation lifecycle, used by the CA-portal and
// firm API routes. Keeps validation + dedupe + email dispatch in one
// place so every entry point behaves identically.
//
// Acceptance lives in accept.ts (called from the provisioning paths).
// ============================================================

import { customerInvitationRepository as repo } from "@/lib/repositories/customer-invitation.repository";
import { notifyCustomerInvite } from "@/lib/notifications";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  EMAIL_REGEX,
  MAX_INVITE_RESENDS,
  inviteExpiry,
} from "./constants";
import { trackedInviteUrl } from "@/lib/firm/onboarding";
import type { CustomerInvitation } from "@prisma/client";

/** Firm user acting as the inviter (CA or CA_FIRM_ADMIN). */
export interface InviteActor {
  id: string;
  organizationId: string;
  firmId: string | null;
  name: string | null;
  email: string;
  userRole: string | null;
}

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

interface CreateInput {
  email: string;
  name?: string | null;
  phone?: string | null;
  company?: string | null;
  message?: string | null;
  /** CA to own the relationship; defaults to the inviter. */
  assignedCaId?: string | null;
  /** Link to a pre-existing CRM Customer record. */
  customerId?: string | null;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
export async function createCustomerInvitation(
  actor: InviteActor,
  input: CreateInput
): Promise<ServiceResult<CustomerInvitation>> {
  const email = String(input.email ?? "").trim();
  const name = input.name ? String(input.name).trim() : null;

  if (!email || !EMAIL_REGEX.test(email)) {
    return { ok: false, status: 400, error: "A valid email is required" };
  }

  // Already a user in this firm org?
  const existingUser = await prisma.user.findFirst({
    where: {
      organizationId: actor.organizationId,
      email: { equals: email, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (existingUser) {
    return { ok: false, status: 409, error: "A user with this email already exists in your firm" };
  }

  // Open invite already in flight?
  const open = await repo.findOpenForOrg(actor.organizationId, email);
  if (open) {
    return { ok: false, status: 409, error: "A pending invitation already exists for this email" };
  }

  // Resolve & validate the assigned CA (defaults to the inviter).
  const assignedCaId = input.assignedCaId?.trim() || actor.id;
  if (assignedCaId !== actor.id) {
    const ca = await prisma.user.findFirst({
      where: {
        id: assignedCaId,
        organizationId: actor.organizationId,
        userRole: { in: ["CA", "CA_FIRM_ADMIN"] },
      },
      select: { id: true },
    });
    if (!ca) {
      return { ok: false, status: 400, error: "Assigned CA must be a member of your firm" };
    }
  }

  // Validate an optional CRM customer link.
  let customerId: string | null = null;
  if (input.customerId) {
    const cust = await prisma.customer.findFirst({
      where: { id: input.customerId, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!cust) {
      return { ok: false, status: 400, error: "Linked customer not found" };
    }
    customerId = cust.id;
  }

  const invite = await repo.create({
    organizationId: actor.organizationId,
    firmId: actor.firmId,
    email,
    name,
    phone: input.phone ? String(input.phone).trim() : null,
    company: input.company ? String(input.company).trim() : null,
    message: input.message ? String(input.message).trim() : null,
    invitedById: actor.id,
    assignedCaId,
    customerId,
    expiresAt: inviteExpiry(),
  });

  await createAuditLog({
    organizationId: actor.organizationId,
    userId: actor.id,
    action: "CREATE",
    entity: "customerInvitation",
    entityId: invite.id,
    description: `Invited customer ${email}`,
    newValue: { email, name, assignedCaId },
  });

  await dispatch(actor, invite, false);
  // Return the freshest row (status flips to SENT on successful dispatch).
  const fresh = (await repo.findById(actor.organizationId, invite.id)) ?? invite;
  return { ok: true, data: fresh };
}

// ---------------------------------------------------------------------------
// Resend
// ---------------------------------------------------------------------------
export async function resendCustomerInvitation(
  actor: InviteActor,
  id: string
): Promise<ServiceResult<CustomerInvitation>> {
  const invite = await repo.findById(actor.organizationId, id);
  if (!invite) return { ok: false, status: 404, error: "Invitation not found" };
  if (invite.status === "ACCEPTED") {
    return { ok: false, status: 409, error: "This invitation has already been accepted" };
  }
  if (invite.resendCount >= MAX_INVITE_RESENDS) {
    return { ok: false, status: 429, error: "Resend limit reached for this invitation" };
  }

  // Refresh expiry on resend so the link stays usable.
  await repo.setStatus(invite.id, invite.status === "EXPIRED" ? "PENDING" : invite.status, {
    expiresAt: inviteExpiry(),
    revokedAt: null,
  });

  const refreshed = (await repo.findById(actor.organizationId, id))!;
  const ok = await dispatch(actor, refreshed, true);
  if (!ok) return { ok: false, status: 502, error: "Failed to send invitation email" };

  await createAuditLog({
    organizationId: actor.organizationId,
    userId: actor.id,
    action: "UPDATE",
    entity: "customerInvitation",
    entityId: invite.id,
    description: `Resent invitation to ${invite.email}`,
  });

  const fresh = (await repo.findById(actor.organizationId, id))!;
  return { ok: true, data: fresh };
}

// ---------------------------------------------------------------------------
// Cancel (revoke)
// ---------------------------------------------------------------------------
export async function cancelCustomerInvitation(
  actor: InviteActor,
  id: string
): Promise<ServiceResult<CustomerInvitation>> {
  const invite = await repo.findById(actor.organizationId, id);
  if (!invite) return { ok: false, status: 404, error: "Invitation not found" };
  if (invite.status === "ACCEPTED") {
    return { ok: false, status: 409, error: "Cannot cancel an accepted invitation" };
  }

  const updated = await repo.setStatus(id, "REVOKED", { revokedAt: new Date() });
  await createAuditLog({
    organizationId: actor.organizationId,
    userId: actor.id,
    action: "DELETE",
    entity: "customerInvitation",
    entityId: id,
    description: `Cancelled invitation to ${invite.email}`,
  });
  return { ok: true, data: updated };
}

// ---------------------------------------------------------------------------
// Email dispatch — marks the invite SENT on success. Best-effort: a
// send failure leaves the invite PENDING so it can be retried.
// ---------------------------------------------------------------------------
async function dispatch(
  actor: InviteActor,
  invite: CustomerInvitation,
  isResend: boolean
): Promise<boolean> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: actor.organizationId },
      select: { name: true, businessProfile: { select: { businessName: true } } },
    });
    const firmName = org?.businessProfile?.businessName ?? org?.name ?? "your accountant";

    await notifyCustomerInvite({
      organizationId: actor.organizationId,
      recipientEmail: invite.email,
      recipientName: invite.name ?? invite.email,
      firmName,
      inviterName: actor.name ?? actor.email,
      message: invite.message ?? undefined,
      inviteUrl: trackedInviteUrl(invite.token),
    });

    await repo.markSent(invite.id, isResend);
    return true;
  } catch (err) {
    console.error("[customer-invite] dispatch failed:", err);
    return false;
  }
}
