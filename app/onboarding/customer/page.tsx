// ============================================================
// /onboarding/customer — Customer KYC onboarding (Module 2).
// Guards:
//   1. Must be authenticated
//   2. Must have CUSTOMER role
//   3. If onboarding complete → /dashboard
//
// Seeds BusinessProfile from any accepted CustomerInvitation so the
// wizard's fields start pre-filled — but does NOT mark any
// OrgOnboardingStage complete just because a field has a value. A
// CA typing a GSTIN into an invite form is not the same as TBX
// verifying it; resume/skip logic lives entirely in the wizard,
// driven by stage completion (see KycOnboardingWizard.tsx).
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { resolveOnboardingEntry } from "@/lib/auth/onboarding-entry";
import { isOnboardingComplete } from "@/services/onboardingService";
import { KycOnboardingWizard } from "@/components/onboarding/KycOnboardingWizard";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Set Up Your Business | FinRP",
  description: "Complete your business KYC to start using FinRP.",
};

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

  // Already done → dashboard
  const done = await isOnboardingComplete(user.organizationId);
  if (done) redirect("/dashboard");

  // Seed field VALUES (not stage completion) from the firm's invitation,
  // only if the customer hasn't already started entering their own data.
  const existingProfile = await prisma.businessProfile.findUnique({ where: { organizationId: user.organizationId } });
  if (!existingProfile) {
    const invite = await prisma.customerInvitation.findFirst({
      where: { acceptedOrganizationId: user.organizationId, status: "ACCEPTED" },
      orderBy: { createdAt: "desc" },
    });
    if (invite) {
      await prisma.businessProfile.create({
        data: {
          organizationId: user.organizationId,
          businessName: invite.company || "My Organization",
          gstin: invite.gstin ?? null,
          pan: invite.pan ?? null,
          industry: invite.industry ?? null,
          address: invite.address ?? null,
          city: invite.city ?? null,
          state: invite.state ?? null,
          country: invite.country ?? null,
          pincode: invite.pincode ?? null,
        },
      });
    }
  }

  return <KycOnboardingWizard />;
}
