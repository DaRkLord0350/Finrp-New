// ============================================================
// /onboarding/role — Role selection screen.
// First-time users choose between CA Firm and Customer.
// Guards:
//   1. Unauthenticated → /sign-in
//   2. Role already set → redirect to correct onboarding/portal
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isOnboardingComplete } from "@/services/onboardingService";
import { RoleSelection } from "@/components/onboarding/RoleSelection";

export const metadata = {
  title: "Choose Your Role | FinRP",
  description: "Select whether you are a CA Firm or a Customer to get started.",
};

export default async function RoleSelectionPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let user;
  try {
    user = await getCurrentUser();
  } catch {
    redirect("/sign-in");
  }

  // Role already chosen — send to appropriate place
  if (user.userRole) {
    const done = await isOnboardingComplete(user.organizationId);
    switch (user.userRole) {
      case "CUSTOMER":
        redirect(done ? "/dashboard" : "/onboarding/customer");
        break;
      case "CA_FIRM_ADMIN":
        redirect(done ? "/firm" : "/onboarding/ca-firm");
        break;
      case "CA":
        redirect("/ca");
        break;
      case "ADMIN":
        redirect("/admin");
        break;
    }
  }

  return <RoleSelection />;
}
