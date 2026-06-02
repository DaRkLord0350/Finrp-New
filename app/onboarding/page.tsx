// ============================================================
// /onboarding — Smart router.
// Examines the user's role and onboarding state and redirects
// to the correct role-specific onboarding path.
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isOnboardingComplete } from "@/services/onboardingService";

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

  // No role selected yet → role selection screen
  if (!user.userRole) redirect("/onboarding/role");

  // Role-specific routing
  const done = await isOnboardingComplete(user.organizationId);

  if (user.userRole === "CA_FIRM_ADMIN") {
    if (done) redirect("/firm");
    redirect("/onboarding/ca-firm");
  }

  if (user.userRole === "CUSTOMER") {
    if (done) redirect("/dashboard");
    redirect("/onboarding/customer");
  }

  // CA and ADMIN users shouldn't be in onboarding
  if (user.userRole === "CA") redirect("/ca");
  if (user.userRole === "ADMIN") redirect("/admin");

  // Fallback
  redirect("/onboarding/role");
}
