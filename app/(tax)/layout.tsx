// ============================================================
// Tax & Compliance Engine — route group layout
//
// RBAC gate (mirrors the other portals):
//   1. Unauthenticated      → /sign-in
//   2. No role selected yet  → /onboarding/welcome
// Otherwise granted. The effective tenant comes from getTenantId()
// (so a CA operating inside a Client Workspace is scoped to the
// client org), and every API independently enforces the tax.* RBAC.
// ============================================================

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import TaxShell from "./TaxShell";

export default async function TaxLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    redirect("/sign-in");
  }

  if (!user.userRole) redirect("/onboarding/welcome");

  return <TaxShell userName={user.name ?? user.email ?? "User"}>{children}</TaxShell>;
}
