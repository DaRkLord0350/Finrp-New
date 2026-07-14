// ============================================================
// lib/services/related-party.service.ts
// Modules 4+5 — Authorized Signatories + Directors/Partners/
// Proprietors/LLP Members/Beneficial Owners, backed by the unified
// OrganizationRelatedParty registry.
//
// CRITICAL: create() always searches by PAN first. The whole reason
// this is one table instead of three is that the same person is
// very often both a Director and a Signatory — if callers blindly
// insert instead of searching, the unification buys nothing and
// produces duplicate rows. See docs/TBX_FOUNDATION.md §13 Risk 3.
// ============================================================

import { relatedPartyRepository } from "@/lib/repositories/related-party.repository";
import { createAuditLog } from "@/lib/audit";
import { RelatedPartyError } from "@/lib/related-party/http";
import { kycStatusService } from "@/lib/services/kyc-status.service";
import * as tbxService from "@/lib/tbx/service";
import type { Prisma } from "@prisma/client";
import type { CreateRelatedPartyInput, UpdateRelatedPartyInput } from "@/lib/validators/related-party";

type Actor = { userId: string | null };

export const relatedPartyService = {
  async list(organizationId: string) {
    return relatedPartyRepository.list(organizationId);
  },

  async getById(organizationId: string, id: string) {
    const party = await relatedPartyRepository.findById(organizationId, id);
    if (!party) throw new RelatedPartyError("Not found", 404);
    return party;
  },

  /**
   * Create — or, if a party with the same PAN already exists for this
   * org, merge the new roles onto the existing row instead of creating
   * a duplicate. This is the required dedup behavior, not optional.
   */
  async create(organizationId: string, actor: Actor, input: CreateRelatedPartyInput) {
    if (input.pan) {
      const existing = await relatedPartyRepository.findByPan(organizationId, input.pan);
      if (existing) {
        const merged = await relatedPartyRepository.addRoles(organizationId, existing.id, input.roles);
        await createAuditLog({
          organizationId,
          userId: actor.userId ?? undefined,
          action: "UPDATE",
          entity: "organization_related_party",
          entityId: existing.id,
          description: `Added role(s) ${input.roles.join(", ")} to existing party "${existing.name}" (matched by PAN)`,
        });
        return merged;
      }
    }

    const party = await relatedPartyRepository.create(organizationId, input);
    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "CREATE",
      entity: "organization_related_party",
      entityId: party.id,
      description: `Added ${input.roles.join(", ")} — ${party.name}`,
    });
    return party;
  },

  async update(organizationId: string, actor: Actor, id: string, input: UpdateRelatedPartyInput) {
    const existing = await relatedPartyRepository.findById(organizationId, id);
    if (!existing) throw new RelatedPartyError("Not found", 404);

    const party = await relatedPartyRepository.update(organizationId, id, input);
    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "UPDATE",
      entity: "organization_related_party",
      entityId: id,
      description: `Updated party "${party.name}"`,
      oldValue: existing as unknown as Prisma.InputJsonValue,
      newValue: input as unknown as Prisma.InputJsonValue,
    });
    return party;
  },

  async remove(organizationId: string, actor: Actor, id: string) {
    const existing = await relatedPartyRepository.findById(organizationId, id);
    if (!existing) throw new RelatedPartyError("Not found", 404);

    await relatedPartyRepository.softDelete(organizationId, id);
    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "DELETE",
      entity: "organization_related_party",
      entityId: id,
      description: `Removed party "${existing.name}"`,
    });
    await relatedPartyService.recomputeSignatoryVerified(organizationId);
  },

  /** Trigger TBX PAN verification for one party (Module 4/5 "Verification Status"). */
  async verify(organizationId: string, actor: Actor, id: string) {
    const party = await relatedPartyService.getById(organizationId, id);
    if (!party.pan) throw new RelatedPartyError("Party has no PAN to verify", 400);

    const result = await tbxService.verifyPan(
      { pan: party.pan, nameToMatch: party.name },
      { organizationId, userId: actor.userId, subjectType: "related_party", subjectId: id }
    );

    const updated = await relatedPartyRepository.recordVerification(id, {
      panVerificationStatus: result.outcome,
      tbxVerificationRef: result.referenceId,
    });

    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "UPDATE",
      entity: "organization_related_party",
      entityId: id,
      description: `TBX PAN verification for "${party.name}": ${result.outcome}`,
    });

    await relatedPartyService.recomputeSignatoryVerified(organizationId);
    return updated;
  },

  /** KycProfile.signatoryVerified = at least one AUTHORIZED_SIGNATORY (ideally the primary) is VERIFIED. */
  async recomputeSignatoryVerified(organizationId: string) {
    const parties = await relatedPartyRepository.list(organizationId);
    const signatories = parties.filter((p) => p.roles.includes("AUTHORIZED_SIGNATORY"));
    const verified = signatories.some((p) => p.verificationStatus === "VERIFIED");
    await kycStatusService.markSignatoryVerified(organizationId, verified);
  },
};
