// ============================================================
// lib/services/ca-relationship.service.ts
//
// Manages the CA org ↔ Business org link that underpins the pricing
// model. A CA invites a business; on acceptance the relationship goes
// ACTIVE, the CA's active-client counter increments (enforced against
// the plan's client ceiling), and the business is granted the free
// Connected plan (auto-converting from Standalone where applicable).
//
// All counter mutations and plan grants happen inside one transaction
// so the CA's activeClientCount, the relationship row, and the
// business's plan never drift apart.
// ============================================================

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { getEntitlements } from "@/lib/billing/entitlements";
import { invalidateEntitlements } from "@/lib/billing/guards";
import { applyConnectedPlan, onCALinkRemoved } from "./subscription.service";

export class RelationshipError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "RelationshipError";
    this.code = code;
    this.status = status;
  }
}

type Tx = Prisma.TransactionClient;

// Org projection used to evaluate the CA's client ceiling.
const CA_PLAN_SELECT = {
  billingCategory: true,
  planType: true,
  subscriptionStatus: true,
  clientLimit: true,
  teamLimit: true,
  activeClientCount: true,
  graceLimit: true,
  relationshipStatus: true,
  linkedCAOrganizationId: true,
} as const;

// ---------------------------------------------------------------------------
// recomputeActiveClientCount — source of truth = ACTIVE relationships
// ---------------------------------------------------------------------------
export async function recomputeActiveClientCount(
  caOrganizationId: string,
  tx: Tx = prisma as unknown as Tx
): Promise<number> {
  const count = await tx.cARelationship.count({
    where: { caOrganizationId, status: "ACTIVE" },
  });
  await tx.organization.update({
    where: { id: caOrganizationId },
    data: { activeClientCount: count },
  });
  return count;
}

// Throw if activating one more client would exceed the CA's ceiling.
async function assertCaHasClientCapacity(tx: Tx, caOrganizationId: string) {
  const ca = await tx.organization.findUnique({
    where: { id: caOrganizationId },
    select: CA_PLAN_SELECT,
  });
  if (!ca) throw new RelationshipError("CA_NOT_FOUND", "CA organization not found", 404);

  // Use the live ACTIVE count rather than the cached column for safety.
  const liveCount = await tx.cARelationship.count({
    where: { caOrganizationId, status: "ACTIVE" },
  });
  const ent = getEntitlements({ ...ca, activeClientCount: liveCount });

  if (ent.hardClientCeiling !== null && liveCount >= ent.hardClientCeiling) {
    throw new RelationshipError(
      "CLIENT_LIMIT_REACHED",
      `Client limit reached for your plan (${liveCount}/${ent.hardClientCeiling}). Upgrade to add more clients.`,
      402
    );
  }
}

// ---------------------------------------------------------------------------
// inviteBusiness — create a PENDING relationship (by email or existing org)
// ---------------------------------------------------------------------------
export interface InviteBusinessInput {
  caOrganizationId: string;
  invitedById: string;
  /** Invitee email — used when the business org may not exist yet. */
  email?: string;
  /** When the CA already knows the business org id, link it directly. */
  businessOrganizationId?: string;
  notes?: string;
}

export async function inviteBusiness(input: InviteBusinessInput) {
  const { caOrganizationId, invitedById, email, businessOrganizationId, notes } = input;
  if (!email && !businessOrganizationId) {
    throw new RelationshipError("INVALID", "Provide an email or a business organization id");
  }

  // Block invites that can never be accepted (CA already at capacity).
  await prisma.$transaction(async (tx) => {
    await assertCaHasClientCapacity(tx, caOrganizationId);
  });

  // Guard against self-invites / linking another CA org as a client.
  if (businessOrganizationId) {
    if (businessOrganizationId === caOrganizationId) {
      throw new RelationshipError("INVALID", "A CA cannot link itself as a client");
    }
    const target = await prisma.organization.findUnique({
      where: { id: businessOrganizationId },
      select: { billingCategory: true },
    });
    if (target?.billingCategory === "CA") {
      throw new RelationshipError("INVALID", "The target organization is a CA firm, not a business", 409);
    }
  }

  // Dedupe: reuse an existing row for this (CA, business) pair or
  // (CA, pending email) so re-inviting is idempotent.
  const existing = await prisma.cARelationship.findFirst({
    where: businessOrganizationId
      ? { caOrganizationId, businessOrganizationId }
      : { caOrganizationId, invitedEmail: email, status: "PENDING" },
  });

  let relationship;
  if (existing) {
    if (existing.status === "ACTIVE") {
      throw new RelationshipError("ALREADY_LINKED", "This business is already connected to your firm", 409);
    }
    relationship = await prisma.cARelationship.update({
      where: { id: existing.id },
      data: {
        status: "PENDING",
        invitedEmail: email ?? existing.invitedEmail,
        invitedById,
        notes: notes ?? existing.notes,
        invitedAt: new Date(),
        terminatedAt: null,
      },
    });
  } else {
    relationship = await prisma.cARelationship.create({
      data: {
        caOrganizationId,
        businessOrganizationId: businessOrganizationId ?? null,
        invitedEmail: email ?? null,
        invitedById,
        notes: notes ?? null,
        status: "PENDING",
      },
    });
  }

  await createAuditLog({
    organizationId: caOrganizationId,
    userId: invitedById,
    action: "CREATE",
    entity: "caRelationship",
    entityId: relationship.id,
    description: `Invited business ${email ?? businessOrganizationId} to connect`,
    newValue: { email, businessOrganizationId },
  });

  // Best-effort invite email (never blocks the flow).
  if (email) void sendInviteEmail(email, relationship.id, caOrganizationId);

  return relationship;
}

// ---------------------------------------------------------------------------
// acceptRelationship — activate a PENDING link + grant Connected
// ---------------------------------------------------------------------------
export interface AcceptInput {
  relationshipId: string;
  /** The business org accepting (required to finalise an email invite). */
  businessOrganizationId: string;
  acceptedById?: string;
}

export async function acceptRelationship({
  relationshipId,
  businessOrganizationId,
  acceptedById,
}: AcceptInput) {
  const result = await prisma.$transaction(async (tx) => {
    const rel = await tx.cARelationship.findUnique({ where: { id: relationshipId } });
    if (!rel) throw new RelationshipError("NOT_FOUND", "Invitation not found", 404);
    if (rel.status === "ACTIVE") return { rel, alreadyActive: true, conversion: null };
    if (rel.status === "TERMINATED") {
      throw new RelationshipError("TERMINATED", "This invitation is no longer valid", 409);
    }
    if (rel.businessOrganizationId && rel.businessOrganizationId !== businessOrganizationId) {
      throw new RelationshipError("MISMATCH", "Invitation belongs to a different business", 403);
    }

    // Enforce the CA's client ceiling before activating.
    await assertCaHasClientCapacity(tx, rel.caOrganizationId);

    const updated = await tx.cARelationship.update({
      where: { id: rel.id },
      data: {
        status: "ACTIVE",
        businessOrganizationId,
        acceptedById: acceptedById ?? null,
        acceptedAt: new Date(),
        terminatedAt: null,
      },
    });

    // Grant Connected (auto-converts Standalone) within the same tx.
    const conversion = await applyConnectedPlan(
      businessOrganizationId,
      rel.caOrganizationId,
      acceptedById,
      tx
    );

    await recomputeActiveClientCount(rel.caOrganizationId, tx);

    return { rel: updated, alreadyActive: false, conversion };
  });

  if (!result.alreadyActive) {
    await invalidateEntitlements(businessOrganizationId);
    await invalidateEntitlements(result.rel.caOrganizationId);
    await createAuditLog({
      organizationId: result.rel.caOrganizationId,
      userId: acceptedById,
      action: "UPDATE",
      entity: "caRelationship",
      entityId: result.rel.id,
      description: `Business ${businessOrganizationId} accepted CA connection${
        result.conversion?.converted ? " (converted from Standalone)" : ""
      }`,
    });
  }

  return result.rel;
}

// ---------------------------------------------------------------------------
// claimPendingForEmail — auto-accept invites matching a new business email
// Called when a business completes onboarding / first logs in.
// ---------------------------------------------------------------------------
export async function claimPendingForEmail(params: {
  email: string;
  businessOrganizationId: string;
  acceptedById?: string;
}) {
  const { email, businessOrganizationId, acceptedById } = params;
  const pending = await prisma.cARelationship.findFirst({
    where: { invitedEmail: { equals: email, mode: "insensitive" }, status: "PENDING" },
    orderBy: { invitedAt: "desc" },
  });
  if (!pending) return null;

  return acceptRelationship({
    relationshipId: pending.id,
    businessOrganizationId,
    acceptedById,
  });
}

// ---------------------------------------------------------------------------
// terminateRelationship — unlink; revert business plan; decrement count
// ---------------------------------------------------------------------------
export async function terminateRelationship(params: {
  relationshipId: string;
  actorUserId?: string;
}) {
  const { relationshipId, actorUserId } = params;

  const { rel, businessOrgId } = await prisma.$transaction(async (tx) => {
    const rel = await tx.cARelationship.findUnique({ where: { id: relationshipId } });
    if (!rel) throw new RelationshipError("NOT_FOUND", "Relationship not found", 404);

    const updated = await tx.cARelationship.update({
      where: { id: rel.id },
      data: { status: "TERMINATED", terminatedAt: new Date() },
    });

    if (rel.businessOrganizationId) {
      await onCALinkRemoved(rel.businessOrganizationId, actorUserId, tx);
    }
    await recomputeActiveClientCount(rel.caOrganizationId, tx);

    return { rel: updated, businessOrgId: rel.businessOrganizationId };
  });

  await invalidateEntitlements(rel.caOrganizationId);
  if (businessOrgId) await invalidateEntitlements(businessOrgId);

  await createAuditLog({
    organizationId: rel.caOrganizationId,
    userId: actorUserId,
    action: "DELETE",
    entity: "caRelationship",
    entityId: rel.id,
    description: `Terminated CA connection with business ${businessOrgId ?? rel.invitedEmail ?? ""}`,
  });

  return rel;
}

// ---------------------------------------------------------------------------
// Email helper (best-effort)
// ---------------------------------------------------------------------------
async function sendInviteEmail(
  email: string,
  relationshipId: string,
  caOrganizationId: string
) {
  try {
    const { enqueueEmail } = await import("@/lib/notifications/email");
    const ca = await prisma.organization.findUnique({
      where: { id: caOrganizationId },
      select: { name: true },
    });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://app.finrp.org";
    const link = `${appUrl}/sign-up?caInvite=${relationshipId}`;
    await enqueueEmail({
      kind: "ca-invite",
      to: email,
      subject: `${ca?.name ?? "Your CA"} invited you to FinRP`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
          <h2>You're invited to connect on FinRP</h2>
          <p><strong>${ca?.name ?? "A CA firm"}</strong> has invited your business to collaborate on FinRP.
          Accept to get the <strong>Connected</strong> plan free — track filings, share documents securely,
          and communicate with your CA in one place.</p>
          <p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Accept invitation</a></p>
          <p style="color:#64748b;font-size:12px">If you weren't expecting this, you can ignore this email.</p>
        </div>`,
    });
  } catch (err) {
    console.error("[ca-relationship] invite email failed:", (err as Error).message);
  }
}
