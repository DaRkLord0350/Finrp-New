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

  // Only CA and ADMIN can access the CA portal
  if (user.userRole === "CUSTOMER") {
    redirect("/dashboard");
  }

  return <CAShell>{children}</CAShell>;
}
