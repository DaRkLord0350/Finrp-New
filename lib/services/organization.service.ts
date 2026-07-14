// ============================================================
// lib/services/organization.service.ts
// Module 1 — Organization Master business rules: profile
// read/update, branch head-office exclusivity, department
// parent-cycle prevention. Every mutation is audit-logged.
//
// Architecture: API route → organizationService → repositories → Prisma.
// ============================================================

import { organizationRepository } from "@/lib/repositories/organization.repository";
import { orgBranchRepository, orgDepartmentRepository } from "@/lib/repositories/org-structure.repository";
import { createAuditLog } from "@/lib/audit";
import { OrganizationError } from "@/lib/organization/http";
import type { Prisma } from "@prisma/client";
import type {
  CreateOrgBranchInput,
  CreateOrgDepartmentInput,
  UpdateOrganizationMasterInput,
  UpdateOrgBranchInput,
  UpdateOrgDepartmentInput,
} from "@/lib/validators/organization";

type Actor = { userId: string | null };

export const organizationService = {
  // ── Organization Master ─────────────────────────────────────
  async getMaster(organizationId: string) {
    const [config, branches, departments] = await Promise.all([
      organizationRepository.getFullConfig(organizationId),
      orgBranchRepository.list(organizationId),
      orgDepartmentRepository.list(organizationId),
    ]);
    return { ...config, branches, departments };
  },

  async updateMaster(organizationId: string, actor: Actor, input: UpdateOrganizationMasterInput) {
    const updated = await organizationRepository.upsertProfile(organizationId, input as Record<string, unknown>);
    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "UPDATE",
      entity: "organization_master",
      entityId: organizationId,
      description: "Updated Organization Master profile",
      newValue: input as unknown as Prisma.InputJsonValue,
    });
    return updated;
  },

  // ── Branches ─────────────────────────────────────────────────
  async listBranches(organizationId: string) {
    return orgBranchRepository.list(organizationId);
  },

  async createBranch(organizationId: string, actor: Actor, input: CreateOrgBranchInput) {
    if (input.isHeadOffice) {
      await orgBranchRepository.clearHeadOffice(organizationId);
    }
    const branch = await orgBranchRepository.create(organizationId, input);
    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "CREATE",
      entity: "org_branch",
      entityId: branch.id,
      description: `Created branch "${branch.name}"`,
    });
    return branch;
  },

  async updateBranch(organizationId: string, actor: Actor, id: string, input: UpdateOrgBranchInput) {
    const existing = await orgBranchRepository.findById(organizationId, id);
    if (!existing) throw new OrganizationError("Branch not found", 404);

    if (input.isHeadOffice) {
      await orgBranchRepository.clearHeadOffice(organizationId, id);
    }
    const branch = await orgBranchRepository.update(organizationId, id, input);
    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "UPDATE",
      entity: "org_branch",
      entityId: id,
      description: `Updated branch "${branch.name}"`,
      oldValue: existing as unknown as Prisma.InputJsonValue,
      newValue: input as unknown as Prisma.InputJsonValue,
    });
    return branch;
  },

  async deleteBranch(organizationId: string, actor: Actor, id: string) {
    const existing = await orgBranchRepository.findById(organizationId, id);
    if (!existing) throw new OrganizationError("Branch not found", 404);

    await orgBranchRepository.delete(organizationId, id);
    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "DELETE",
      entity: "org_branch",
      entityId: id,
      description: `Deleted branch "${existing.name}"`,
    });
  },

  // ── Departments ──────────────────────────────────────────────
  async listDepartments(organizationId: string) {
    return orgDepartmentRepository.list(organizationId);
  },

  async createDepartment(organizationId: string, actor: Actor, input: CreateOrgDepartmentInput) {
    if (input.parentDepartmentId) {
      const parent = await orgDepartmentRepository.findById(organizationId, input.parentDepartmentId);
      if (!parent) throw new OrganizationError("Parent department not found", 400);
    }
    const department = await orgDepartmentRepository.create(organizationId, input);
    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "CREATE",
      entity: "org_department",
      entityId: department.id,
      description: `Created department "${department.name}"`,
    });
    return department;
  },

  async updateDepartment(organizationId: string, actor: Actor, id: string, input: UpdateOrgDepartmentInput) {
    const existing = await orgDepartmentRepository.findById(organizationId, id);
    if (!existing) throw new OrganizationError("Department not found", 404);

    if (input.parentDepartmentId) {
      const parent = await orgDepartmentRepository.findById(organizationId, input.parentDepartmentId);
      if (!parent) throw new OrganizationError("Parent department not found", 400);
      const wouldCycle = await orgDepartmentRepository.wouldCreateCycle(organizationId, id, input.parentDepartmentId);
      if (wouldCycle) throw new OrganizationError("This would create a circular department hierarchy", 400);
    }

    const department = await orgDepartmentRepository.update(organizationId, id, input);
    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "UPDATE",
      entity: "org_department",
      entityId: id,
      description: `Updated department "${department.name}"`,
      oldValue: existing as unknown as Prisma.InputJsonValue,
      newValue: input as unknown as Prisma.InputJsonValue,
    });
    return department;
  },

  async deleteDepartment(organizationId: string, actor: Actor, id: string) {
    const existing = await orgDepartmentRepository.findById(organizationId, id);
    if (!existing) throw new OrganizationError("Department not found", 404);

    await orgDepartmentRepository.delete(organizationId, id);
    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "DELETE",
      entity: "org_department",
      entityId: id,
      description: `Deleted department "${existing.name}"`,
    });
  },
};
