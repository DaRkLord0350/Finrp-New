// ============================================================
// /onboarding — Smart router.
// Examines the user's role and onboarding state and redirects
// to the correct role-specific onboarding path.
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { resolveOnboardingEntry } from "@/lib/auth/onboarding-entry";
import { isOnboardingComplete } from "@/services/onboardingService";
import { isOrganizationActivated } from "@/lib/billing/guards";

export const metadata = {
  title: "Getting Started | FinRP",
  description: "Complete your setup to get started with FinRP.",
};

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let user;
  try {
    user = await getCurrentUser();
  } catch {
    redirect("/sign-in");
  }

  // No role yet → resolve any pending invitation automatically (or
  // fall back to the self-signup role picker).
  if (!user.userRole) redirect((await resolveOnboardingEntry(user)).redirectTo);

  // Role-specific routing
  const done = await isOnboardingComplete(user.organizationId);

  if (user.userRole === "CA_FIRM_ADMIN") {
    if (!done) redirect("/onboarding/ca-firm");
    if (!(await isOrganizationActivated(user.organizationId))) {
      redirect("/onboarding/plan");
    }
    redirect("/firm");
  }

  if (user.userRole === "CUSTOMER") {
    if (!done) redirect("/onboarding/customer");
    if (!(await isOrganizationActivated(user.organizationId))) {
      redirect("/onboarding/plan");
    }
    redirect("/dashboard");
  }

  // CA and ADMIN users shouldn't be in onboarding
  if (user.userRole === "CA") redirect("/ca");
  redirect("/admin");
}
