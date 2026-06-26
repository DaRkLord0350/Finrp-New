// ============================================================
// /onboarding/ca-firm — CA Firm onboarding wizard.
// Guards:
//   1. Must be authenticated
//   2. Must have CA_FIRM_ADMIN role
//   3. If onboarding complete → /firm
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { resolveOnboardingEntry } from "@/lib/auth/onboarding-entry";
import { isOnboardingComplete } from "@/services/onboardingService";
import { CAFirmOnboardingWizard } from "@/components/onboarding/CAFirmOnboardingWizard";

export const metadata = {
  title: "Set Up Your CA Firm | FinRP",
  description: "Complete your CA firm setup to start managing clients.",
};

export default async function CAFirmOnboardingPage() {
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
  if (user.userRole === "CUSTOMER") redirect("/onboarding/customer");
  if (user.userRole === "CA") redirect("/ca");
  if (user.userRole === "ADMIN") redirect("/admin");

  // Already done → firm portal
  const done = await isOnboardingComplete(user.organizationId);
  if (done) redirect("/firm");

  return <CAFirmOnboardingWizard />;
}
