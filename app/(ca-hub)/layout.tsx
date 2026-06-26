// ============================================================
// CA Hub layout — Practice Operating System
//
// RBAC guard (mirrors the (ca) / (firm) / (admin) portals):
//   1. Unauthenticated            → /sign-in
//   2. No role selected yet       → /onboarding/role
//   3. CUSTOMER role              → /dashboard  (wrong portal)
//   4. CA | CA_FIRM_ADMIN | ADMIN → granted
//
// Multi-tenant: getCurrentUser() resolves the Clerk user → DB user
// (org + firm). Downstream pages/APIs scope by firmId / organizationId.
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { resolveOnboardingEntry } from "@/lib/auth/onboarding-entry";
import { redirect } from "next/navigation";
import CAHubShell from "./CAHubShell";

export default async function CAHubLayout({
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

  if (!user.userRole) redirect((await resolveOnboardingEntry(user)).redirectTo);
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  // CA, CA_FIRM_ADMIN, ADMIN → allowed into the practice OS
  return <CAHubShell>{children}</CAHubShell>;
}
