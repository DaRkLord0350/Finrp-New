// ============================================================
// FinRP — Onboarding Service
// All DB operations for the onboarding wizard.
// Every query is scoped to organizationId.
// ============================================================

import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import type { OnboardingModule, InviteRole, DataImportOption, ThemePreference, DashboardLayout } from "@/types/onboarding";

// ---------------------------------------------------------------------------
// Save Organization Details (Step 2)
// Updates org name/slug and upserts BusinessProfile.
// ---------------------------------------------------------------------------
export async function saveOrganizationDetails(
  organizationId: string,
  data: {
    orgName: string;
    businessType: string;
    gstNumber?: string;
    currency: string;
    timezone: string;
    logoUrl?: string;
    address?: string;
  }
) {
  const slug = data.orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  const uniqueSlug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: organizationId },
      data: { name: data.orgName, slug: uniqueSlug },
    }),
    prisma.businessProfile.upsert({
      where: { organizationId },
      create: {
        organizationId,
        businessName: data.orgName,
        businessType: data.businessType,
        taxId: data.gstNumber ?? null,
        currency: data.currency,
        timezone: data.timezone,
        logoUrl: data.logoUrl ?? null,
        address: data.address ?? null,
        onboardingStep: 2,
      },
      update: {
        businessName: data.orgName,
        businessType: data.businessType,
        taxId: data.gstNumber ?? null,
        currency: data.currency,
        timezone: data.timezone,
        logoUrl: data.logoUrl ?? null,
        address: data.address ?? null,
        onboardingStep: 2,
      },
    }),
  ]);
}

// ---------------------------------------------------------------------------
// Save Module Selection (Step 3)
// ---------------------------------------------------------------------------
export async function saveModuleSelection(
  organizationId: string,
  modules: OnboardingModule[]
) {
  await prisma.organization.update({
    where: { id: organizationId },
    data: { enabledModules: modules },
  });

  // Mirror feature flags in Settings
  await prisma.settings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      inventoryEnabled: modules.includes("INVENTORY"),
      payrollEnabled: modules.includes("HR"),
      complianceEnabled: true,
      loanModuleEnabled: modules.includes("ACCOUNTING"),
    },
    update: {
      inventoryEnabled: modules.includes("INVENTORY"),
      payrollEnabled: modules.includes("HR"),
      loanModuleEnabled: modules.includes("ACCOUNTING"),
    },
  });

  await prisma.businessProfile.upsert({
    where: { organizationId },
    create: {
      organizationId,
      businessName: "My Organization",
      onboardingStep: 3,
    },
    update: { onboardingStep: 3 },
  });
}

// ---------------------------------------------------------------------------
// Record Team Invite (Step 4 — stores invitation record)
// Idempotent: replaces any existing pending invite for the same email.
// ---------------------------------------------------------------------------
export async function recordInvitation(
  organizationId: string,
  invitedBy: string,
  email: string,
  role: InviteRole
) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Remove any previous pending invite for this email in this org
  await prisma.invitation.deleteMany({
    where: { organizationId, email, acceptedAt: null },
  });

  await prisma.invitation.create({
    data: {
      organizationId,
      email,
      role: role as Role,
      invitedBy,
      expiresAt,
    },
  });
}

// ---------------------------------------------------------------------------
// Save Data Import Choice (Step 5)
// ---------------------------------------------------------------------------
export async function saveImportChoice(
  organizationId: string,
  importOption: DataImportOption
) {
  await prisma.settings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      metadata: { importOption },
    },
    update: {
      metadata: { importOption },
    },
  });

  await prisma.businessProfile.upsert({
    where: { organizationId },
    create: {
      organizationId,
      businessName: "My Organization",
      onboardingStep: 5,
    },
    update: { onboardingStep: 5 },
  });
}

// ---------------------------------------------------------------------------
// Save Preferences (Step 7)
// ---------------------------------------------------------------------------
export async function savePreferences(
  organizationId: string,
  prefs: {
    theme: ThemePreference;
    emailNotifications: boolean;
    smsNotifications: boolean;
    dashboardLayout: DashboardLayout;
  }
) {
  await prisma.settings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      emailNotifications: prefs.emailNotifications,
      smsNotifications: prefs.smsNotifications,
      metadata: {
        theme: prefs.theme,
        dashboardLayout: prefs.dashboardLayout,
      },
    },
    update: {
      emailNotifications: prefs.emailNotifications,
      smsNotifications: prefs.smsNotifications,
      metadata: {
        theme: prefs.theme,
        dashboardLayout: prefs.dashboardLayout,
      },
    },
  });

  await prisma.businessProfile.upsert({
    where: { organizationId },
    create: {
      organizationId,
      businessName: "My Organization",
      onboardingStep: 7,
    },
    update: { onboardingStep: 7 },
  });
}

// ---------------------------------------------------------------------------
// Complete Onboarding (Step 8)
// ---------------------------------------------------------------------------
export async function completeOnboarding(organizationId: string) {
  await prisma.$transaction([
    prisma.organization.update({
      where: { id: organizationId },
      data: { onboardingCompleted: true },
    }),
    prisma.businessProfile.upsert({
      where: { organizationId },
      create: {
        organizationId,
        businessName: "My Organization",
        onboardingComplete: true,
        onboardingStep: 8,
      },
      update: {
        onboardingComplete: true,
        onboardingStep: 8,
      },
    }),
  ]);
}

// ---------------------------------------------------------------------------
// Check if onboarding is complete for an organization
// ---------------------------------------------------------------------------
export async function isOnboardingComplete(organizationId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      onboardingCompleted: true,
      businessProfile: { select: { onboardingComplete: true } },
    },
  });

  if (!org) return false;
  return (
    org.onboardingCompleted ||
    (org.businessProfile?.onboardingComplete ?? false)
  );
}
