"use server";

// ============================================================
// CA Firm onboarding server actions
// Called by CAFirmOnboardingWizard at each step.
// The Firm record is created on final completion.
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import type { OnboardingActionResult } from "@/types/onboarding";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function getAuthContext() {
  const user = await getCurrentUser();
  return { user, organizationId: user.organizationId };
}

// ---------------------------------------------------------------------------
// Step 1: Save Firm Information
// Persisted to BusinessProfile.metadata for recovery; Firm created on finish.
// ---------------------------------------------------------------------------
export async function actionSaveFirmInfo(data: {
  firmName: string;
  registrationNumber?: string;
  email: string;
  phone?: string;
}): Promise<OnboardingActionResult> {
  try {
    const { organizationId } = await getAuthContext();

    await prisma.$transaction([
      prisma.organization.update({
        where: { id: organizationId },
        data: { name: data.firmName },
      }),
      prisma.businessProfile.upsert({
        where: { organizationId },
        create: {
          organizationId,
          businessName: data.firmName,
          registrationNo: data.registrationNumber ?? null,
          contactEmail: data.email,
          contactPhone: data.phone ?? null,
          onboardingStep: 1,
        },
        update: {
          businessName: data.firmName,
          registrationNo: data.registrationNumber ?? null,
          contactEmail: data.email,
          contactPhone: data.phone ?? null,
          onboardingStep: 1,
        },
      }),
    ]);

    return { success: true };
  } catch (err) {
    console.error("[actionSaveFirmInfo]", err);
    return { success: false, error: "Failed to save firm information" };
  }
}

// ---------------------------------------------------------------------------
// Step 2: Save Office Details
// ---------------------------------------------------------------------------
export async function actionSaveOfficeDetails(data: {
  address: string;
  city: string;
  state: string;
  country: string;
}): Promise<OnboardingActionResult> {
  try {
    const { organizationId } = await getAuthContext();

    await prisma.businessProfile.upsert({
      where: { organizationId },
      create: {
        organizationId,
        businessName: "My Firm",
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        onboardingStep: 2,
      },
      update: {
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        onboardingStep: 2,
      },
    });

    return { success: true };
  } catch (err) {
    console.error("[actionSaveOfficeDetails]", err);
    return { success: false, error: "Failed to save office details" };
  }
}

// ---------------------------------------------------------------------------
// Step 3: Save Team Setup
// ---------------------------------------------------------------------------
export async function actionSaveTeamSetup(data: {
  teamSize: string;
  inviteEmails: string[];
}): Promise<OnboardingActionResult> {
  try {
    const { user, organizationId } = await getAuthContext();

    // Store team size in metadata
    await prisma.businessProfile.upsert({
      where: { organizationId },
      create: {
        organizationId,
        businessName: "My Firm",
        companySize: data.teamSize,
        onboardingStep: 3,
      },
      update: {
        companySize: data.teamSize,
        onboardingStep: 3,
      },
    });

    // Create pending invitations for each email
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await Promise.allSettled(
      data.inviteEmails
        .filter((e) => e.trim())
        .map(async (email) => {
          await prisma.invitation.deleteMany({
            where: { organizationId, email, acceptedAt: null },
          });
          return prisma.invitation.create({
            data: {
              organizationId,
              email,
              role: "STAFF",
              invitedBy: user.id,
              expiresAt,
            },
          });
        })
    );

    return { success: true };
  } catch (err) {
    console.error("[actionSaveTeamSetup]", err);
    return { success: false, error: "Failed to save team setup" };
  }
}

// ---------------------------------------------------------------------------
// Step 4: Save Service Configuration
// ---------------------------------------------------------------------------
export async function actionSaveServiceConfig(data: {
  services: string[];
}): Promise<OnboardingActionResult> {
  try {
    const { organizationId } = await getAuthContext();

    await prisma.organization.update({
      where: { id: organizationId },
      data: { enabledModules: data.services },
    });

    await prisma.businessProfile.upsert({
      where: { organizationId },
      create: { organizationId, businessName: "My Firm", onboardingStep: 4 },
      update: { onboardingStep: 4 },
    });

    return { success: true };
  } catch (err) {
    console.error("[actionSaveServiceConfig]", err);
    return { success: false, error: "Failed to save service configuration" };
  }
}

// ---------------------------------------------------------------------------
// Step 5: Save Client Migration Choice
// ---------------------------------------------------------------------------
export async function actionSaveClientMigration(
  migrationOption: "CSV" | "ZOHO" | "SKIP"
): Promise<OnboardingActionResult> {
  try {
    const { organizationId } = await getAuthContext();

    await prisma.businessProfile.upsert({
      where: { organizationId },
      create: {
        organizationId,
        businessName: "My Firm",
        onboardingStep: 5,
      },
      update: {
        onboardingStep: 5,
      },
    });

    // Store migration choice in Settings metadata (Settings has Json? metadata field)
    await prisma.settings.upsert({
      where: { organizationId },
      create: { organizationId, metadata: { clientMigration: migrationOption } },
      update: { metadata: { clientMigration: migrationOption } },
    });

    return { success: true };
  } catch (err) {
    console.error("[actionSaveClientMigration]", err);
    return { success: false, error: "Failed to save migration choice" };
  }
}

// ---------------------------------------------------------------------------
// Step 6: Complete CA Firm Onboarding
// Creates the Firm record, links it to the user, and marks org as complete.
// ---------------------------------------------------------------------------
export async function actionCompleteFirmOnboarding(): Promise<OnboardingActionResult> {
  try {
    const { user, organizationId } = await getAuthContext();

    // Retrieve the accumulated firm data from BusinessProfile
    const profile = await prisma.businessProfile.findUnique({
      where: { organizationId },
    });

    const firmName = profile?.businessName ?? "My CA Firm";
    const registrationNumber = profile?.registrationNo ?? null;
    const email = profile?.contactEmail ?? null;
    const phone = profile?.contactPhone ?? null;

    // Upsert the Firm — handles re-runs safely
    const existingFirm = await prisma.firm.findFirst({
      where: { ownerId: user.id },
    });

    let firmId: string;

    if (existingFirm) {
      firmId = existingFirm.id;
      await prisma.firm.update({
        where: { id: existingFirm.id },
        data: {
          name: firmName,
          registrationNumber,
          email,
          phone,
          address: profile?.address ?? null,
          city: profile?.city ?? null,
          state: profile?.state ?? null,
          country: profile?.country ?? null,
        },
      });
    } else {
      const firm = await prisma.firm.create({
        data: {
          name: firmName,
          registrationNumber,
          email,
          phone,
          address: profile?.address ?? null,
          city: profile?.city ?? null,
          state: profile?.state ?? null,
          country: profile?.country ?? null,
          ownerId: user.id,
          isActive: true,
        },
      });
      firmId = firm.id;
    }

    // Link user to the firm and mark onboarding complete
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { firmId },
      }),
      prisma.organization.update({
        where: { id: organizationId },
        data: { onboardingCompleted: true },
      }),
      prisma.businessProfile.upsert({
        where: { organizationId },
        create: {
          organizationId,
          businessName: firmName,
          onboardingComplete: true,
          onboardingStep: 6,
        },
        update: {
          onboardingComplete: true,
          onboardingStep: 6,
        },
      }),
    ]);

    await createAuditLog({
      organizationId,
      userId: user.id,
      action: "CREATE",
      entity: "firm",
      entityId: firmId,
      description: `Completed CA firm onboarding — created firm "${firmName}"`,
    });

    return { success: true };
  } catch (err) {
    console.error("[actionCompleteFirmOnboarding]", err);
    return { success: false, error: "Failed to complete firm onboarding" };
  }
}
