// ============================================================
// /onboarding/customer — Customer-specific onboarding wizard.
// Guards:
//   1. Must be authenticated
//   2. Must have CUSTOMER role
//   3. If onboarding complete → /dashboard
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { resolveOnboardingEntry } from "@/lib/auth/onboarding-entry";
import { isOnboardingComplete } from "@/services/onboardingService";
import { isOrganizationActivated } from "@/lib/billing/guards";
import { CustomerOnboardingWizard } from "@/components/onboarding/CustomerOnboardingWizard";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Set Up Your Business | FinRP",
  description: "Complete your business setup to start using FinRP.",
};

// Business-profile fields a CA firm can plausibly have captured when
// they invited this customer. Pincode and businessType stay excluded —
// the firm's invite form never asks for them, so they can never be
// "complete" and would otherwise permanently block the skip path.
const BUSINESS_FIELD_KEYS = [
  "companyName",
  "gstNumber",
  "pan",
  "industry",
  "address",
  "city",
  "state",
  "country",
] as const;

export default async function CustomerOnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let user;
  try {
    user = await getCurrentUser();
  } catch {
    redirect("/sign-in");
  }

  // No role yet → resolve any pending invitation automatically
  if (!user.userRole) redirect((await resolveOnboardingEntry(user)).redirectTo);

  // Wrong role → correct portal
  if (user.userRole === "CA_FIRM_ADMIN") redirect("/onboarding/ca-firm");
  if (user.userRole === "CA") redirect("/ca");
  if (user.userRole === "ADMIN") redirect("/admin");

  // Already done → plan picker if needed, otherwise dashboard
  const done = await isOnboardingComplete(user.organizationId);
  if (done) {
    if (!(await isOrganizationActivated(user.organizationId))) {
      redirect("/onboarding/plan");
    }
    redirect("/dashboard");
  }

  // ── Pre-fill from the firm's invitation + any already-saved profile ──
  const [invite, profile] = await Promise.all([
    prisma.customerInvitation.findFirst({
      where: { acceptedOrganizationId: user.organizationId, status: "ACCEPTED" },
      orderBy: { createdAt: "desc" },
    }),
    user.organization.businessProfile
      ? Promise.resolve(user.organization.businessProfile)
      : prisma.businessProfile.findUnique({ where: { organizationId: user.organizationId } }),
  ]);

  // Only trust BusinessProfile over the invitation once the customer has
  // actually submitted Step 1 themselves — a profile row can exist as a
  // placeholder stub created by a later step's upsert (e.g. Financial
  // Setup), which must not block the invitation's data from applying.
  const customerOwnDataExists = (profile?.onboardingStep ?? 0) >= 1;
  function pick(profileVal: string | null | undefined, inviteVal: string | null | undefined): string | undefined {
    if (customerOwnDataExists && profileVal) return profileVal;
    return inviteVal ?? undefined;
  }

  const prefill = {
    companyName: pick(profile?.businessName, invite?.company),
    gstNumber: pick(profile?.gstin, invite?.gstin),
    pan: pick(profile?.pan, invite?.pan),
    industry: pick(profile?.industry, invite?.industry),
    address: pick(profile?.address, invite?.address),
    city: pick(profile?.city, invite?.city),
    state: pick(profile?.state, invite?.state),
    country: pick(profile?.country, invite?.country),
    pincode: pick(profile?.pincode, invite?.pincode),
    businessType: customerOwnDataExists ? (profile?.businessType ?? undefined) : undefined,
  };

  const missingBusinessFields = BUSINESS_FIELD_KEYS.filter((key) => {
    const value = key === "companyName" ? prefill.companyName : prefill[key as keyof typeof prefill];
    return !value;
  });

  let initialStep = 1;
  if (missingBusinessFields.length === 0) {
    initialStep = 3;
    // Silently persist the now-complete business profile so the data is
    // actually saved — the customer never sees a form for it.
    await prisma.businessProfile.upsert({
      where: { organizationId: user.organizationId },
      create: {
        organizationId: user.organizationId,
        businessName: prefill.companyName!,
        pan: prefill.pan ?? null,
        taxId: prefill.gstNumber ?? null,
        gstin: prefill.gstNumber ?? null,
        industry: prefill.industry!,
        businessType: prefill.businessType ?? null,
        address: prefill.address!,
        city: prefill.city!,
        state: prefill.state!,
        country: prefill.country!,
        pincode: prefill.pincode ?? null,
        onboardingStep: 2,
      },
      update: {
        businessName: prefill.companyName!,
        pan: prefill.pan ?? null,
        taxId: prefill.gstNumber ?? null,
        gstin: prefill.gstNumber ?? null,
        industry: prefill.industry!,
        address: prefill.address!,
        city: prefill.city!,
        state: prefill.state!,
        country: prefill.country!,
        pincode: prefill.pincode ?? null,
        onboardingStep: Math.max(profile?.onboardingStep ?? 0, 2),
      },
    });
  }

  return (
    <CustomerOnboardingWizard
      prefill={prefill}
      missingBusinessFields={missingBusinessFields}
      initialStep={initialStep}
    />
  );
}
