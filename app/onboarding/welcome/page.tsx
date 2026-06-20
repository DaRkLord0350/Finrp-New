// ============================================================
// /onboarding/welcome — entry screen with the two onboarding paths.
// Only new (null-role) users see this; everyone else is routed onward.
// ============================================================

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { WelcomeScreen } from "@/components/onboarding/WelcomeScreen";

export const metadata = { title: "Welcome — FinRP" };

export default async function OnboardingWelcomePage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");

  // Users who already have a role belong in the smart router, not here.
  if (user.userRole) redirect("/onboarding");

  return <WelcomeScreen />;
}
