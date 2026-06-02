"use server";

// ============================================================
// FinRP — Onboarding Server Actions
// All actions verify auth + org scope before any DB write.
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { getCurrentUser, invalidateUserCache } from "@/lib/auth/session";
import {
  saveOrganizationDetails,
  saveModuleSelection,
  recordInvitation,
  saveImportChoice,
  savePreferences,
  completeOnboarding,
} from "@/services/onboardingService";
import { seedDemoData } from "@/lib/onboarding/demo-seeder";
import { createAuditLog } from "@/lib/audit";
import type {
  OnboardingModule,
  InviteRole,
  DataImportOption,
  ThemePreference,
  DashboardLayout,
  OnboardingActionResult,
  DemoSeedResult,
} from "@/types/onboarding";

// ---------------------------------------------------------------------------
// Helper: get current user + org, throws if unauthenticated
// ---------------------------------------------------------------------------
async function getAuthContext() {
  const user = await getCurrentUser();
  return { user, organizationId: user.organizationId };
}

// ---------------------------------------------------------------------------
// Action: Save Organization Details (Step 2)
// ---------------------------------------------------------------------------
export async function actionSaveOrganizationDetails(data: {
  orgName: string;
  businessType: string;
  gstNumber?: string;
  currency: string;
  timezone: string;
  logoUrl?: string;
  address?: string;
}): Promise<OnboardingActionResult> {
  try {
    const { user, organizationId } = await getAuthContext();

    await saveOrganizationDetails(organizationId, data);

    await createAuditLog({
      organizationId,
      userId: user.id,
      action: "UPDATE",
      entity: "organization",
      entityId: organizationId,
      description: "Updated organization details during onboarding",
    });

    return { success: true };
  } catch (err) {
    console.error("[actionSaveOrganizationDetails]", err);
    return { success: false, error: "Failed to save organization details" };
  }
}

// ---------------------------------------------------------------------------
// Action: Save Module Selection (Step 3)
// ---------------------------------------------------------------------------
export async function actionSaveModuleSelection(
  modules: OnboardingModule[]
): Promise<OnboardingActionResult> {
  try {
    const { organizationId } = await getAuthContext();

    await saveModuleSelection(organizationId, modules);

    return { success: true };
  } catch (err) {
    console.error("[actionSaveModuleSelection]", err);
    return { success: false, error: "Failed to save module selection" };
  }
}

// ---------------------------------------------------------------------------
// Action: Send Team Invitation (Step 4)
// ---------------------------------------------------------------------------
export async function actionSendInvitation(
  email: string,
  role: InviteRole
): Promise<OnboardingActionResult> {
  try {
    const { user, organizationId } = await getAuthContext();

    await recordInvitation(organizationId, user.id, email, role);

    return { success: true };
  } catch (err) {
    console.error("[actionSendInvitation]", err);
    return { success: false, error: "Failed to record invitation" };
  }
}

// ---------------------------------------------------------------------------
// Action: Save Data Import Choice (Step 5)
// ---------------------------------------------------------------------------
export async function actionSaveImportChoice(
  importOption: DataImportOption
): Promise<OnboardingActionResult> {
  try {
    const { organizationId } = await getAuthContext();

    await saveImportChoice(organizationId, importOption);

    return { success: true };
  } catch (err) {
    console.error("[actionSaveImportChoice]", err);
    return { success: false, error: "Failed to save import choice" };
  }
}

// ---------------------------------------------------------------------------
// Action: Seed Demo Data (Step 6)
// ---------------------------------------------------------------------------
export async function actionSeedDemoData(): Promise<DemoSeedResult> {
  try {
    const { organizationId } = await getAuthContext();

    const result = await seedDemoData(organizationId);

    return result;
  } catch (err) {
    console.error("[actionSeedDemoData]", err);
    return {
      success: false,
      seeded: { customers: 0, items: 0, invoices: 0, expenses: 0, employees: 0 },
      error: "Failed to seed demo data",
    };
  }
}

// ---------------------------------------------------------------------------
// Action: Save Preferences (Step 7)
// ---------------------------------------------------------------------------
export async function actionSavePreferences(prefs: {
  theme: ThemePreference;
  emailNotifications: boolean;
  smsNotifications: boolean;
  dashboardLayout: DashboardLayout;
}): Promise<OnboardingActionResult> {
  try {
    const { organizationId } = await getAuthContext();

    await savePreferences(organizationId, prefs);

    return { success: true };
  } catch (err) {
    console.error("[actionSavePreferences]", err);
    return { success: false, error: "Failed to save preferences" };
  }
}

// ---------------------------------------------------------------------------
// Action: Complete Onboarding (Step 8)
// After persisting, bust the user + tenant cache so the layout re-reads
// from DB on the next request and sees onboardingCompleted = true.
// ---------------------------------------------------------------------------
export async function actionCompleteOnboarding(): Promise<OnboardingActionResult> {
  try {
    const { user, organizationId } = await getAuthContext();

    await completeOnboarding(organizationId);

    await createAuditLog({
      organizationId,
      userId: user.id,
      action: "UPDATE",
      entity: "organization",
      entityId: organizationId,
      description: "Completed onboarding wizard",
    });

    // Bust cache so layout sees onboardingCompleted = true immediately
    const { userId } = await auth();
    if (userId) await invalidateUserCache(userId);

    return { success: true };
  } catch (err) {
    console.error("[actionCompleteOnboarding]", err);
    return { success: false, error: "Failed to complete onboarding" };
  }
}
