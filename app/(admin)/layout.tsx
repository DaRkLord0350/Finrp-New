import { getCurrentUser } from "@/lib/auth/session";
import { resolveOnboardingEntry } from "@/lib/auth/onboarding-entry";
import { redirect } from "next/navigation";
import AdminShell from "./AdminShell";

export default async function AdminLayout({
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

  if (user.userRole !== "ADMIN") {
    if (user.userRole === "CA_FIRM_ADMIN") redirect("/firm");
    if (user.userRole === "CA") redirect("/ca");
    redirect("/dashboard");
  }

  return <AdminShell>{children}</AdminShell>;
}
