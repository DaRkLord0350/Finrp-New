import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
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

  if (user.userRole !== "CA_FIRM_ADMIN") {
    if (user.userRole === "ADMIN") redirect("/admin");
    if (user.userRole === "CA") redirect("/ca");
    redirect("/dashboard");
  }

  return <FirmShell>{children}</FirmShell>;
}
