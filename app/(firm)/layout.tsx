import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { isOnboardingComplete } from "@/services/onboardingService";
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

  // New users haven't selected a role yet → show role selection
  if (!user.userRole) redirect("/onboarding/role");

  if (user.userRole !== "CA_FIRM_ADMIN") {
    if (user.userRole === "ADMIN") redirect("/admin");
    if (user.userRole === "CA") redirect("/ca");
    redirect("/dashboard");
  }

  // Guard: CA firm admins who haven't finished onboarding
  const done = await isOnboardingComplete(user.organizationId);
  if (!done) redirect("/onboarding/ca-firm");

  return <FirmShell>{children}</FirmShell>;
}
