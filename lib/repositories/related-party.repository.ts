// ============================================================
// lib/repositories/related-party.repository.ts
// Tenant-scoped reads/writes for OrganizationRelatedParty
// (Modules 4+5 — Signatories/Directors/Partners/Proprietors/
// LLP Members/Beneficial Owners, unified registry).
// ============================================================

import { prisma } from "./base.repository";
import type { CreateRelatedPartyInput, UpdateRelatedPartyInput } from "@/lib/validators/related-party";
import type { Prisma } from "@prisma/client";

export const relatedPartyRepository = {
  async list(organizationId: string) {
    return prisma.organizationRelatedParty.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
  },

  async findById(organizationId: string, id: string) {
    return prisma.organizationRelatedParty.findFirst({ where: { id, organizationId, deletedAt: null } });
  },

  /** Dedupe lookup — required before creating a new row (see related-party.service.ts). */
  async findByPan(organizationId: string, pan: string) {
    return prisma.organizationRelatedParty.findFirst({
      where: { organizationId, pan, deletedAt: null },
    });
  },

  async create(organizationId: string, data: CreateRelatedPartyInput) {
    return prisma.organizationRelatedParty.create({
      data: {
        organizationId,
        ...data,
        email: data.email || null,
        shareholdingPercent: data.shareholdingPercent ?? undefined,
      } as Prisma.OrganizationRelatedPartyUncheckedCreateInput,
    });
  },

  async addRoles(organizationId: string, id: string, roles: string[]) {
    const existing = await prisma.organizationRelatedParty.findFirst({
      where: { id, organizationId },
      select: { roles: true },
    });
    if (!existing) return null;
    const merged = Array.from(new Set([...existing.roles, ...roles]));
    return prisma.organizationRelatedParty.update({
      where: { id },
      data: { roles: merged as Prisma.OrganizationRelatedPartyUpdateInput["roles"] },
    });
  },

  async update(organizationId: string, id: string, data: UpdateRelatedPartyInput) {
    return prisma.organizationRelatedParty.update({
      where: { id },
      data: {
        ...data,
        email: data.email === "" ? null : data.email,
        shareholdingPercent: data.shareholdingPercent ?? undefined,
      } as Prisma.OrganizationRelatedPartyUncheckedUpdateInput,
    });
  },

  /** Soft delete — mirrors OrganizationRelatedParty.deletedAt. */
  async softDelete(organizationId: string, id: string) {
    return prisma.organizationRelatedParty.updateMany({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });
  },

  /** System-managed verification-result write (never user-supplied). */
  async recordVerification(
    id: string,
    result: { panVerificationStatus: Prisma.OrganizationRelatedPartyUpdateInput["panVerificationStatus"]; tbxVerificationRef?: string }
  ) {
    return prisma.organizationRelatedParty.update({
      where: { id },
      data: {
        panVerificationStatus: result.panVerificationStatus,
        verificationStatus: result.panVerificationStatus,
        tbxVerificationRef: result.tbxVerificationRef,
      },
    });
  },

  async countByOrg(organizationId: string) {
    return prisma.organizationRelatedParty.count({ where: { organizationId, deletedAt: null } });
  },
};
