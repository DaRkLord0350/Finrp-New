// ============================================================
// Dashboard layout — server + client hybrid.
// The server part ensures the user is provisioned in the DB
// before any child route renders. Runs on every navigation
// but is fast (single indexed DB lookup, no-op if found).
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import DashboardShell from "./DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This call auto-provisions Organization + User if missing.
  // If Clerk says not authenticated, getCurrentUser throws → middleware
  // already redirects to sign-in before we get here.
  try {
    await getCurrentUser();
  } catch {
    redirect("/sign-in");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
