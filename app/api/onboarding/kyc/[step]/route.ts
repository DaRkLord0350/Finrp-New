// ============================================================
// POST /api/onboarding/kyc/[step]
// Per-step save for the KYC wizard. `step` selects the payload
// shape and which OrgOnboardingStage advances. Each step marks its
// stage COMPLETED once the step's action has been taken — for gst/
// pan this means "a TBX verification call was made" (pass or fail,
// with an explicit skip escape hatch), NOT "verification passed".
// Actual pass/fail rolls up into KycProfile via kyc-status.service.ts
// and is what ultimately gates KYC_PENDING/APPROVED — conflating the
// two would silently skip real verification (see §13 Risk 2).
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import { orgOnboardingStageRepository } from "@/lib/repositories/org-onboarding-stage.repository";
import { relatedPartyRepository } from "@/lib/repositories/related-party.repository";
import { kycStatusService } from "@/lib/services/kyc-status.service";
import * as tbxService from "@/lib/tbx/service";

type RouteCtx = { params: Promise<{ step: string }> };

async function requireActor() {
  const { userId } = await auth();
  if (!userId) return null;
  const organizationId = await getTenantId();
  if (!organizationId) return null;
  const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!dbUser) return null;
  return { organizationId, dbUser };
}

export async function POST(req: Request, { params }: RouteCtx) {
  const actor = await requireActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { organizationId, dbUser } = actor;

  const { step } = await params;
  const body = await req.json().catch(() => ({}));

  try {
    switch (step) {
      case "business-info": {
        const { companyName, businessType, industry } = body;
        if (!companyName || !industry) {
          return NextResponse.json({ error: "companyName and industry are required" }, { status: 400 });
        }
        await prisma.businessProfile.upsert({
          where: { organizationId },
          create: { organizationId, businessName: companyName, businessType: businessType || null, industry },
          update: { businessName: companyName, businessType: businessType || null, industry },
        });
        const stageRow = await orgOnboardingStageRepository.setStatus(organizationId, "BUSINESS_INFO_COMPLETED", "COMPLETED");
        return NextResponse.json({ stage: stageRow });
      }

      case "gst": {
        const { gstin, skip } = body;
        if (skip) {
          const stageRow = await orgOnboardingStageRepository.setStatus(organizationId, "GST_VERIFIED", "COMPLETED", "Skipped by user");
          return NextResponse.json({ stage: stageRow, skipped: true });
        }
        if (!gstin) return NextResponse.json({ error: "gstin is required" }, { status: 400 });

        const result = await tbxService.verifyGstin(
          { gstin },
          { organizationId, userId: dbUser.id, subjectType: "organization", subjectId: organizationId }
        );
        await prisma.businessProfile.upsert({
          where: { organizationId },
          create: { organizationId, businessName: "My Organization", gstin, gstVerificationStatus: result.outcome },
          update: { gstin, gstVerificationStatus: result.outcome },
        });
        const stageRow = await orgOnboardingStageRepository.setStatus(organizationId, "GST_VERIFIED", "COMPLETED");
        await orgIdentityRecompute(organizationId);
        return NextResponse.json({ stage: stageRow, verification: result });
      }

      case "pan": {
        const { pan, skip } = body;
        if (skip) {
          const stageRow = await orgOnboardingStageRepository.setStatus(organizationId, "PAN_VERIFIED", "COMPLETED", "Skipped by user");
          return NextResponse.json({ stage: stageRow, skipped: true });
        }
        if (!pan) return NextResponse.json({ error: "pan is required" }, { status: 400 });

        const result = await tbxService.verifyPan(
          { pan },
          { organizationId, userId: dbUser.id, subjectType: "organization", subjectId: organizationId }
        );
        await prisma.businessProfile.upsert({
          where: { organizationId },
          create: { organizationId, businessName: "My Organization", pan, panVerificationStatus: result.outcome },
          update: { pan, panVerificationStatus: result.outcome },
        });
        const stageRow = await orgOnboardingStageRepository.setStatus(organizationId, "PAN_VERIFIED", "COMPLETED");
        await orgIdentityRecompute(organizationId);
        return NextResponse.json({ stage: stageRow, verification: result });
      }

      case "address": {
        const { address, city, state, country, pincode, operationalAddress } = body;
        if (!address || !city || !state || !country) {
          return NextResponse.json({ error: "address, city, state, country are required" }, { status: 400 });
        }
        await prisma.businessProfile.upsert({
          where: { organizationId },
          create: { organizationId, businessName: "My Organization", address, city, state, country, pincode: pincode || null, operationalAddress: operationalAddress || undefined },
          update: { address, city, state, country, pincode: pincode || null, operationalAddress: operationalAddress || null },
        });
        const stageRow = await orgOnboardingStageRepository.setStatus(organizationId, "ADDRESS_COMPLETED", "COMPLETED");
        return NextResponse.json({ stage: stageRow });
      }

      case "people": {
        const parties = await relatedPartyRepository.list(organizationId);
        const hasSignatory = parties.some((p) => p.roles.includes("AUTHORIZED_SIGNATORY"));
        const hasDirector = parties.some((p) =>
          ["DIRECTOR", "PARTNER", "PROPRIETOR", "LLP_MEMBER"].some((r) => p.roles.includes(r as never))
        );
        if (!hasSignatory) {
          return NextResponse.json({ error: "At least one Authorized Signatory is required" }, { status: 400 });
        }
        const s1 = await orgOnboardingStageRepository.setStatus(organizationId, "SIGNATORY_ADDED", "COMPLETED");
        const s2 = await orgOnboardingStageRepository.setStatus(
          organizationId,
          "DIRECTORS_ADDED",
          "COMPLETED",
          hasDirector ? undefined : "No directors/partners applicable (e.g. sole proprietorship)"
        );
        return NextResponse.json({ stages: [s1, s2] });
      }

      case "documents": {
        const stageRow = await orgOnboardingStageRepository.setStatus(organizationId, "DOCUMENTS_UPLOADED", "COMPLETED");
        return NextResponse.json({ stage: stageRow });
      }

      default:
        return NextResponse.json({ error: `Unknown step: ${step}` }, { status: 400 });
    }
  } catch (error) {
    console.error(`[ONBOARDING_KYC_STEP_${step}]`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function orgIdentityRecompute(organizationId: string) {
  const profile = await prisma.businessProfile.findUnique({
    where: { organizationId },
    select: { panVerificationStatus: true },
  });
  // PAN is universally mandatory; GST is tracked but not required for
  // every entity type (e.g. below the registration threshold).
  await kycStatusService.markOrgIdentityVerified(organizationId, profile?.panVerificationStatus === "VERIFIED");
}
