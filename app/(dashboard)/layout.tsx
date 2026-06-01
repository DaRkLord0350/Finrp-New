// ============================================================
// Dashboard layout — server + client hybrid.
// Guards:
//   1. Unauthenticated → /sign-in (via getCurrentUser throw)
//   2. CA/ADMIN role → /ca (wrong portal)
//   3. Onboarding not complete → /onboarding
//   4. Provisioning: auto-creates Org+User if Clerk webhook missed.
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { isOnboardingComplete } from "@/services/onboardingService";
import DashboardShell from "./DashboardShell";

export default async function DashboardLayout({
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

  // Route each role to its own portal
  if (user.userRole === "ADMIN") redirect("/admin");
  if (user.userRole === "CA_FIRM_ADMIN") redirect("/firm");
  if (user.userRole === "CA") redirect("/ca");

  // Guard: redirect users who haven't completed onboarding
  const done = await isOnboardingComplete(user.organizationId);
  if (!done) {
    redirect("/onboarding/customer");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
