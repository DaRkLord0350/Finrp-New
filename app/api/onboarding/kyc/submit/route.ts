// ============================================================
// POST /api/onboarding/kyc/submit
// Wizard's final Submit step: registers a TBX customer/KYC profile,
// flips KycProfile to SUBMITTED, marks the terminal onboarding
// stages complete. Also preserves the three side effects the OLD
// 6-step wizard's actionCompleteCustomerOnboarding performed —
// "onboarding complete" (can the user reach /dashboard at all) and
// "KYC complete" (is the dashboard read-only) are separate gates;
// conflating them would either lock every new signup out of their
// own dashboard, or silently skip billing initialization.
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, invalidateUserCache } from "@/lib/auth/session";
import { completeOnboarding } from "@/services/onboardingService";
import { initializeBilling } from "@/lib/services/subscription.service";
import { claimPendingForEmail } from "@/lib/services/ca-relationship.service";
import { createAuditLog } from "@/lib/audit";
import { orgOnboardingStageRepository } from "@/lib/repositories/org-onboarding-stage.repository";
import { kycStatusService } from "@/lib/services/kyc-status.service";
import * as tbxService from "@/lib/tbx/service";
import { mapTbxError } from "@/lib/tbx/http";

export async function POST() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const organizationId = await getTenantId();
    if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getCurrentUser();
    const profile = await prisma.businessProfile.findUnique({ where: { organizationId } });
    if (!profile?.businessName) {
      return NextResponse.json({ error: "Business information is incomplete" }, { status: 400 });
    }

    // Register the KYC/identity profile with TBX. Deliberately NOT assumed
    // to provision any account/payment capability — only the identity id.
    const result = await tbxService.createTbxCustomer(
      {
        organizationId,
        legalName: profile.businessName,
        pan: profile.pan ?? undefined,
        gstin: profile.gstin ?? undefined,
        cin: profile.cin ?? undefined,
        email: user.email ?? undefined,
        phone: profile.phone ?? undefined,
      },
      { organizationId, userId: user.id, subjectType: "organization", subjectId: organizationId }
    );

    await prisma.businessProfile.update({
      where: { organizationId },
      data: {
        tbxCustomerId: result.tbxCustomerId,
        tbxOrganizationId: result.tbxOrganizationId ?? null,
        tbxStatus: result.tbxStatus ?? null,
        tbxLastSyncAt: new Date(),
      },
    });

    await orgOnboardingStageRepository.setStatus(organizationId, "TBX_CUSTOMER_CREATED", "COMPLETED");
    await orgOnboardingStageRepository.setStatus(organizationId, "KYC_SUBMITTED", "COMPLETED");
    await kycStatusService.markSubmitted(organizationId, true);

    // ── Preserved from the old wizard's terminal action ──
    await completeOnboarding(organizationId);
    await initializeBilling(organizationId, "BUSINESS", user.id);
    if (user.email) {
      await claimPendingForEmail({
        email: user.email,
        businessOrganizationId: organizationId,
        acceptedById: user.id,
      }).catch((err) => {
        console.error("[kyc-onboarding] claimPendingForEmail failed:", (err as Error).message);
      });
    }
    await createAuditLog({
      organizationId,
      userId: user.id,
      action: "UPDATE",
      entity: "organization",
      entityId: organizationId,
      description: "Completed KYC onboarding — TBX customer created",
    });
    await invalidateUserCache(clerkId);

    const kycProfile = await kycStatusService.getProfile(organizationId);
    return NextResponse.json({ success: true, tbxCustomerId: result.tbxCustomerId, kycProfile });
  } catch (error) {
    return mapTbxError(error, "ONBOARDING_KYC_SUBMIT");
  }
}
