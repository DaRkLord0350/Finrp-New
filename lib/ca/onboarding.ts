// ============================================================
// lib/ca/onboarding.ts
//
// Derives a customer's 7-stage onboarding journey from real signals
// (CustomerInvitation timestamps, bridged org profile + bank, uploaded
// documents, signed agreement) and persists the verdict to
// ClientOnboardingStage so it can be queried/aggregated cheaply.
// ============================================================

import { prisma } from "@/lib/prisma";
import { resolveCustomerOrgId } from "./portal";
import type { OnboardingStageKey, OnboardingStageStatus } from "@prisma/client";

export const STAGE_ORDER: OnboardingStageKey[] = [
  "INVITATION_SENT",
  "ACCEPTED",
  "PROFILE_COMPLETED",
  "BANK_CONNECTED",
  "DOCUMENTS_UPLOADED",
  "AGREEMENT_SIGNED",
  "READY",
];

export const STAGE_LABELS: Record<OnboardingStageKey, string> = {
  INVITATION_SENT: "Invitation Sent",
  ACCEPTED: "Accepted",
  PROFILE_COMPLETED: "Profile Completed",
  BANK_CONNECTED: "Bank Connected",
  DOCUMENTS_UPLOADED: "Documents Uploaded",
  AGREEMENT_SIGNED: "Agreement Signed",
  READY: "Ready",
};

export interface OnboardingStageView {
  stage: OnboardingStageKey;
  label: string;
  status: OnboardingStageStatus;
  completedAt: Date | null;
}

export interface OnboardingSummary {
  stages: OnboardingStageView[];
  completed: number;
  total: number;
  progress: number; // 0-100
  ready: boolean;
}

/**
 * Compute the onboarding stages for a customer from current signals and
 * persist them (idempotent upsert). Returns the ordered stage views +
 * progress. Cheap enough to call on a profile/dashboard render.
 */
export async function computeOnboardingStages(
  customerId: string,
  organizationId: string
): Promise<OnboardingSummary> {
  const orgId = await resolveCustomerOrgId(customerId);

  const [invitation, docCount, agreement, businessProfile, bankCount] = await Promise.all([
    prisma.customerInvitation.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customerDocument.count({ where: { customerId } }),
    prisma.clientAgreementSummary.findFirst({
      where: { customerId, kind: "CUSTOMER", status: "ACTIVE" },
    }),
    orgId
      ? prisma.businessProfile.findUnique({
          where: { organizationId: orgId },
          select: { businessName: true },
        })
      : Promise.resolve(null),
    orgId
      ? prisma.bankConnection.count({ where: { organizationId: orgId } })
      : Promise.resolve(0),
  ]);

  // Resolve the completion timestamp for each stage (null = not done).
  // INVITATION_SENT must reflect a CONFIRMED email dispatch (sentAt) —
  // never the row's createdAt, otherwise a never-delivered invite (or
  // a customer with no invitation at all) shows as falsely "sent".
  const completedAt: Record<OnboardingStageKey, Date | null> = {
    INVITATION_SENT: invitation?.sentAt ?? null,
    ACCEPTED: invitation?.acceptedAt ?? null,
    PROFILE_COMPLETED: businessProfile?.businessName ? (invitation?.acceptedAt ?? new Date()) : null,
    BANK_CONNECTED: invitation?.bankConnectedAt ?? (bankCount > 0 ? new Date() : null),
    DOCUMENTS_UPLOADED: invitation?.documentsUploadedAt ?? (docCount > 0 ? new Date() : null),
    AGREEMENT_SIGNED: agreement ? (agreement.updatedAt ?? new Date()) : null,
    READY: invitation?.completedAt ?? null,
  };

  // READY is implied when every prior stage is complete.
  const priorAllDone = STAGE_ORDER.slice(0, -1).every((s) => completedAt[s] != null);
  if (!completedAt.READY && priorAllDone) completedAt.READY = new Date();

  const stages: OnboardingStageView[] = STAGE_ORDER.map((stage, idx) => {
    const done = completedAt[stage] != null;
    // First not-done stage after a completed one is "in progress".
    const prevDone = idx === 0 || completedAt[STAGE_ORDER[idx - 1]] != null;
    const status: OnboardingStageStatus = done
      ? "COMPLETED"
      : prevDone
        ? "IN_PROGRESS"
        : "PENDING";
    return { stage, label: STAGE_LABELS[stage], status, completedAt: completedAt[stage] };
  });

  // Persist (best-effort; never blocks the render).
  try {
    await prisma.$transaction(
      stages.map((s, idx) =>
        prisma.clientOnboardingStage.upsert({
          where: { customerId_stage: { customerId, stage: s.stage } },
          create: {
            customerId,
            organizationId,
            stage: s.stage,
            status: s.status,
            completedAt: s.completedAt,
            sortOrder: idx,
          },
          update: { status: s.status, completedAt: s.completedAt, organizationId },
        })
      )
    );
  } catch (err) {
    console.error("[ca/onboarding] persist failed:", err);
  }

  const completed = stages.filter((s) => s.status === "COMPLETED").length;
  return {
    stages,
    completed,
    total: stages.length,
    progress: Math.round((completed / stages.length) * 100),
    ready: completedAt.READY != null,
  };
}
