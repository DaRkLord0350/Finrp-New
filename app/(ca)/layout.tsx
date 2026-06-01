// ============================================================
// CA Portal layout
// Guards:
//   1. Unauthenticated → /sign-in
//   2. CUSTOMER role → /dashboard (wrong portal)
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import CAShell from "./CAShell";

export default async function CALayout({
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

  // Route non-CA users to their correct portal
  if (user.userRole === "ADMIN") redirect("/admin");
  if (user.userRole === "CA_FIRM_ADMIN") redirect("/firm");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  return <CAShell>{children}</CAShell>;
}
