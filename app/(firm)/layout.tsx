import { getCurrentUser } from "@/lib/auth/session";
import { resolveOnboardingEntry } from "@/lib/auth/onboarding-entry";
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

  // New users haven't picked a role yet → resolve their invitation
  // automatically (or fall back to the self-signup picker).
  if (!user.userRole) redirect((await resolveOnboardingEntry(user)).redirectTo);

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
