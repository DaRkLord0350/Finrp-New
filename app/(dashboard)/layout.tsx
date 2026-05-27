// ============================================================
// Dashboard layout — server + client hybrid.
// Guards:
//   1. Unauthenticated → /sign-in (via getCurrentUser throw)
//   2. Onboarding not complete → /onboarding
//   3. Provisioning: auto-creates Org+User if Clerk webhook missed.
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

  // Guard: redirect users who haven't completed onboarding
  const done = await isOnboardingComplete(user.organizationId);
  if (!done) {
    redirect("/onboarding");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
