import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { isOnboardingComplete } from "@/services/onboardingService";
import { isOrganizationActivated } from "@/lib/billing/guards";
import FirmShell from "./FirmShell";

export default async function FirmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    redirect("/sign-in");
  }

  // New users haven't picked an entry path yet → welcome screen
  if (!user.userRole) redirect("/onboarding/welcome");

  if (user.userRole !== "CA_FIRM_ADMIN") {
    if (user.userRole === "ADMIN") redirect("/admin");
    if (user.userRole === "CA") redirect("/ca");
    redirect("/dashboard");
  }

  // Guard: CA firm admins who haven't finished onboarding
  const done = await isOnboardingComplete(user.organizationId);
  if (!done) redirect("/onboarding/ca-firm");

  // Gate the portal until a plan is chosen + (if paid) activated.
  if (!(await isOrganizationActivated(user.organizationId))) {
    redirect("/onboarding/plan");
  }

  return <FirmShell>{children}</FirmShell>;
}
