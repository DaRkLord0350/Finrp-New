// ============================================================
// lib/repositories/org-structure.repository.ts
// Tenant-scoped reads/writes for OrgBranch and OrgDepartment
// (Module 1 — Organization Master: Branches & Departments).
// ============================================================

import { prisma } from "./base.repository";
import type {
  CreateOrgBranchInput,
  CreateOrgDepartmentInput,
  UpdateOrgBranchInput,
  UpdateOrgDepartmentInput,
} from "@/lib/validators/organization";

export const orgBranchRepository = {
  async list(organizationId: string) {
    return prisma.orgBranch.findMany({
      where: { organizationId },
      orderBy: [{ isHeadOffice: "desc" }, { createdAt: "asc" }],
    });
  },

  async findById(organizationId: string, id: string) {
    return prisma.orgBranch.findFirst({ where: { id, organizationId } });
  },

  async findHeadOffice(organizationId: string, excludeId?: string) {
    return prisma.orgBranch.findFirst({
      where: { organizationId, isHeadOffice: true, ...(excludeId && { id: { not: excludeId } }) },
    });
  },

  async create(organizationId: string, data: CreateOrgBranchInput) {
    return prisma.orgBranch.create({ data: { organizationId, ...data } });
  },

  async update(organizationId: string, id: string, data: UpdateOrgBranchInput) {
    return prisma.orgBranch.update({ where: { id, organizationId }, data });
  },

  async clearHeadOffice(organizationId: string, exceptId?: string) {
    return prisma.orgBranch.updateMany({
      where: { organizationId, isHeadOffice: true, ...(exceptId && { id: { not: exceptId } }) },
      data: { isHeadOffice: false },
    });
  },

  async delete(organizationId: string, id: string) {
    return prisma.orgBranch.deleteMany({ where: { id, organizationId } });
  },
};

export const orgDepartmentRepository = {
  async list(organizationId: string) {
    return prisma.orgDepartment.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      include: { headUser: { select: { id: true, name: true, email: true } } },
    });
  },

  async findById(organizationId: string, id: string) {
    return prisma.orgDepartment.findFirst({ where: { id, organizationId } });
  },

  async create(organizationId: string, data: CreateOrgDepartmentInput) {
    return prisma.orgDepartment.create({ data: { organizationId, ...data } });
  },

  async update(organizationId: string, id: string, data: UpdateOrgDepartmentInput) {
    return prisma.orgDepartment.update({ where: { id, organizationId }, data });
  },

  async delete(organizationId: string, id: string) {
    return prisma.orgDepartment.deleteMany({ where: { id, organizationId } });
  },

  /** Walk up the parent chain from `candidateParentId` — true if `departmentId` appears in it. */
  async wouldCreateCycle(organizationId: string, departmentId: string, candidateParentId: string): Promise<boolean> {
    if (departmentId === candidateParentId) return true;

    let currentId: string | null = candidateParentId;
    const seen = new Set<string>();
    while (currentId) {
      if (currentId === departmentId) return true;
      if (seen.has(currentId)) return true; // pre-existing cycle — treat as blocked
      seen.add(currentId);

      const current: { parentDepartmentId: string | null } | null = await prisma.orgDepartment.findFirst({
        where: { id: currentId, organizationId },
        select: { parentDepartmentId: true },
      });
      currentId = current?.parentDepartmentId ?? null;
    }
    return false;
  },
};
