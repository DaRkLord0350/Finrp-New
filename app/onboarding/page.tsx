// ============================================================
// /onboarding — Server entry point for the onboarding wizard.
// Guards:
//   1. Unauthenticated users → /sign-in (Clerk middleware)
//   2. Users who already completed onboarding → /dashboard
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isOnboardingComplete } from "@/services/onboardingService";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const metadata = {
  title: "Set Up Your Organization | FinRP",
  description: "Complete your organization setup to get started with FinRP.",
};

export default async function OnboardingPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  let user;
  try {
    user = await getCurrentUser();
  } catch {
    redirect("/sign-in");
  }

  // If onboarding is already done, send to dashboard
  const done = await isOnboardingComplete(user.organizationId);
  if (done) {
    redirect("/dashboard");
  }

  return <OnboardingWizard />;
}
