// ============================================================
// GET /api/onboarding/kyc
// Current wizard state: BusinessProfile subset + OrgOnboardingStage
// list (ensured) + related parties + documents + KycProfile status.
// Drives the wizard's initial hydration AND its resume logic — the
// wizard resumes from stage COMPLETED status, never from raw field
// presence (see docs/TBX_FOUNDATION.md §13 Risk 2).
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import { orgOnboardingStageRepository } from "@/lib/repositories/org-onboarding-stage.repository";
import { relatedPartyRepository } from "@/lib/repositories/related-party.repository";
import { documentRepository } from "@/lib/repositories/document.repository";
import { kycStatusService } from "@/lib/services/kyc-status.service";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const organizationId = await getTenantId();
    if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [profile, stages, relatedParties, documents, kycProfile] = await Promise.all([
      prisma.businessProfile.findUnique({ where: { organizationId } }),
      orgOnboardingStageRepository.ensureAll(organizationId),
      relatedPartyRepository.list(organizationId),
      documentRepository.listOrgDocuments(organizationId),
      kycStatusService.getProfile(organizationId),
    ]);

    return NextResponse.json({ profile, stages, relatedParties, documents, kycProfile });
  } catch (error) {
    console.error("[ONBOARDING_KYC_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
