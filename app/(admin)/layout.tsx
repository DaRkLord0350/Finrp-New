import { getCurrentUser } from "@/lib/auth/session";
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

  // New users haven't picked an entry path yet → welcome screen
  if (!user.userRole) redirect("/onboarding/welcome");

  if (user.userRole !== "ADMIN") {
    if (user.userRole === "CA_FIRM_ADMIN") redirect("/firm");
    if (user.userRole === "CA") redirect("/ca");
    redirect("/dashboard");
  }

  return <AdminShell>{children}</AdminShell>;
}
