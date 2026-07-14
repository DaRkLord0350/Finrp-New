// ============================================================
// lib/repositories/org-onboarding-stage.repository.ts
// Tenant-scoped reads/writes for OrgOnboardingStage (Module 7 —
// the detailed per-step history the KYC wizard advances through;
// mirrors the existing ClientOnboardingStage shape).
// ============================================================

import { prisma } from "./base.repository";
import type { OrgOnboardingStageKey, OnboardingStageStatus } from "@prisma/client";

const STAGE_ORDER: OrgOnboardingStageKey[] = [
  "ACCOUNT_CREATED",
  "BUSINESS_INFO_COMPLETED",
  "GST_VERIFIED",
  "PAN_VERIFIED",
  "SIGNATORY_ADDED",
  "DIRECTORS_ADDED",
  "ADDRESS_COMPLETED",
  "DOCUMENTS_UPLOADED",
  "TBX_CUSTOMER_CREATED",
  "KYC_SUBMITTED",
  "WORKSPACE_ACTIVATED",
];

export const orgOnboardingStageRepository = {
  async list(organizationId: string) {
    return prisma.orgOnboardingStage.findMany({
      where: { organizationId },
      orderBy: { sortOrder: "asc" },
    });
  },

  /** Ensure all 11 stage rows exist (PENDING) for a newly-onboarding org. */
  async ensureAll(organizationId: string) {
    await prisma.$transaction(
      STAGE_ORDER.map((stage, i) =>
        prisma.orgOnboardingStage.upsert({
          where: { organizationId_stage: { organizationId, stage } },
          create: { organizationId, stage, sortOrder: i },
          update: {},
        })
      )
    );
    return orgOnboardingStageRepository.list(organizationId);
  },

  async setStatus(
    organizationId: string,
    stage: OrgOnboardingStageKey,
    status: OnboardingStageStatus,
    note?: string
  ) {
    const sortOrder = STAGE_ORDER.indexOf(stage);
    return prisma.orgOnboardingStage.upsert({
      where: { organizationId_stage: { organizationId, stage } },
      create: {
        organizationId,
        stage,
        status,
        sortOrder: sortOrder === -1 ? 0 : sortOrder,
        note,
        completedAt: status === "COMPLETED" ? new Date() : null,
      },
      update: {
        status,
        note,
        completedAt: status === "COMPLETED" ? new Date() : null,
      },
    });
  },

  async isCompleted(organizationId: string, stage: OrgOnboardingStageKey): Promise<boolean> {
    const row = await prisma.orgOnboardingStage.findUnique({
      where: { organizationId_stage: { organizationId, stage } },
      select: { status: true },
    });
    return row?.status === "COMPLETED";
  },
};

export { STAGE_ORDER };
