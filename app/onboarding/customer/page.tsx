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
import { isOnboardingComplete } from "@/services/onboardingService";
import { CustomerOnboardingWizard } from "@/components/onboarding/CustomerOnboardingWizard";

export const metadata = {
  title: "Set Up Your Business | FinRP",
  description: "Complete your business setup to start using FinRP.",
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

  // Role not chosen → role selection
  if (!user.userRole) redirect("/onboarding/role");

  // Wrong role → correct portal
  if (user.userRole === "CA_FIRM_ADMIN") redirect("/onboarding/ca-firm");
  if (user.userRole === "CA") redirect("/ca");
  if (user.userRole === "ADMIN") redirect("/admin");

  // Already done → dashboard
  const done = await isOnboardingComplete(user.organizationId);
  if (done) redirect("/dashboard");

  return <CustomerOnboardingWizard />;
}
