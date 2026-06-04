"use server";

// ============================================================
// Customer-specific onboarding server actions
// Reuses core onboarding service where logic overlaps.
// New actions cover customer-specific steps.
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { getCurrentUser, invalidateUserCache } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { completeOnboarding } from "@/services/onboardingService";
import { createAuditLog } from "@/lib/audit";
import type { OnboardingActionResult } from "@/types/onboarding";

// ---------------------------------------------------------------------------
// Step 1: Save Business Information
// ---------------------------------------------------------------------------
export async function actionSaveBusinessInfo(data: {
  companyName: string;
  pan?: string;
  gstNumber?: string;
  industry: string;
  businessType: string;
}): Promise<OnboardingActionResult> {
  try {
    const user = await getCurrentUser();
    const { organizationId } = user;

    await prisma.$transaction([
      prisma.organization.update({
        where: { id: organizationId },
        data: { name: data.companyName },
      }),
      prisma.businessProfile.upsert({
        where: { organizationId },
        create: {
          organizationId,
          businessName: data.companyName,
          pan: data.pan ?? null,
          taxId: data.gstNumber ?? null,
          gstin: data.gstNumber ?? null,
          industry: data.industry,
          businessType: data.businessType,
          onboardingStep: 1,
        },
        update: {
          businessName: data.companyName,
          pan: data.pan ?? null,
          taxId: data.gstNumber ?? null,
          gstin: data.gstNumber ?? null,
          industry: data.industry,
          businessType: data.businessType,
          onboardingStep: 1,
        },
      }),
    ]);

    return { success: true };
  } catch (err) {
    console.error("[actionSaveBusinessInfo]", err);
    return { success: false, error: "Failed to save business information" };
  }
}

// ---------------------------------------------------------------------------
// Step 2: Save Address Information
// ---------------------------------------------------------------------------
export async function actionSaveAddressInfo(data: {
  address: string;
  city: string;
  state: string;
  country: string;
  pincode?: string;
}): Promise<OnboardingActionResult> {
  try {
    const user = await getCurrentUser();
    const { organizationId } = user;

    await prisma.businessProfile.upsert({
      where: { organizationId },
      create: {
        organizationId,
        businessName: "My Organization",
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        pincode: data.pincode ?? null,
        onboardingStep: 2,
      },
      update: {
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        pincode: data.pincode ?? null,
        onboardingStep: 2,
      },
    });

    return { success: true };
  } catch (err) {
    console.error("[actionSaveAddressInfo]", err);
    return { success: false, error: "Failed to save address information" };
  }
}

// ---------------------------------------------------------------------------
// Step 3: Save Financial Setup
// ---------------------------------------------------------------------------
export async function actionSaveFinancialSetup(data: {
  currency: string;
  fiscalYearStart: string;
  openingBankBalance?: number;
  monthlyRevenueEstimate?: number;
  monthlyExpenseEstimate?: number;
  defaultTaxRate?: number;
}): Promise<OnboardingActionResult> {
  try {
    const user = await getCurrentUser();
    const { organizationId } = user;

    await prisma.businessProfile.upsert({
      where: { organizationId },
      create: {
        organizationId,
        businessName: "My Organization",
        currency: data.currency,
        openingBankBalance: data.openingBankBalance ?? null,
        monthlyRevenueEstimate: data.monthlyRevenueEstimate ?? null,
        monthlyExpenseEstimate: data.monthlyExpenseEstimate ?? null,
        defaultTaxRate: data.defaultTaxRate ?? null,
        onboardingStep: 3,
      },
      update: {
        currency: data.currency,
        openingBankBalance: data.openingBankBalance ?? null,
        monthlyRevenueEstimate: data.monthlyRevenueEstimate ?? null,
        monthlyExpenseEstimate: data.monthlyExpenseEstimate ?? null,
        defaultTaxRate: data.defaultTaxRate ?? null,
        onboardingStep: 3,
      },
    });

    await prisma.settings.upsert({
      where: { organizationId },
      create: { organizationId, defaultTaxRate: data.defaultTaxRate ?? 18 },
      update: { defaultTaxRate: data.defaultTaxRate ?? 18 },
    });

    return { success: true };
  } catch (err) {
    console.error("[actionSaveFinancialSetup]", err);
    return { success: false, error: "Failed to save financial setup" };
  }
}

// ---------------------------------------------------------------------------
// Step 4: Save Import Choice (reuses existing type)
// ---------------------------------------------------------------------------
export async function actionSaveCustomerImportChoice(
  importOption: "ZOHO" | "TALLY" | "CSV" | "SKIP"
): Promise<OnboardingActionResult> {
  try {
    const user = await getCurrentUser();
    const { organizationId } = user;

    await prisma.settings.upsert({
      where: { organizationId },
      create: { organizationId, metadata: { importOption } },
      update: { metadata: { importOption } },
    });

    await prisma.businessProfile.upsert({
      where: { organizationId },
      create: { organizationId, businessName: "My Organization", onboardingStep: 4 },
      update: { onboardingStep: 4 },
    });

    return { success: true };
  } catch (err) {
    console.error("[actionSaveCustomerImportChoice]", err);
    return { success: false, error: "Failed to save import choice" };
  }
}

// ---------------------------------------------------------------------------
// Step 6: Complete Customer Onboarding
// ---------------------------------------------------------------------------
export async function actionCompleteCustomerOnboarding(): Promise<OnboardingActionResult> {
  try {
    const user = await getCurrentUser();
    const { organizationId } = user;

    await completeOnboarding(organizationId);

    await createAuditLog({
      organizationId,
      userId: user.id,
      action: "UPDATE",
      entity: "organization",
      entityId: organizationId,
      description: "Completed customer onboarding",
    });

    // Bust cache so the layout sees onboardingCompleted = true immediately
    const { userId: clerkId } = await auth();
    if (clerkId) await invalidateUserCache(clerkId);

    return { success: true };
  } catch (err) {
    console.error("[actionCompleteCustomerOnboarding]", err);
    return { success: false, error: "Failed to complete onboarding" };
  }
}
