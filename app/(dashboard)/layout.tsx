// ============================================================
// Dashboard layout — server + client hybrid.
//
// Two ways in:
//   CUSTOMER             → their own organization (unchanged).
//   CA / FIRM / ADMIN    → ONLY inside a validated Client
//                          Workspace (impersonation). The same
//                          pages/APIs then serve the client org
//                          via the tenant override; the shell
//                          adds the ClientBanner + workspace nav.
//
// Guards:
//   1. Unauthenticated → /sign-in (via getCurrentUser throw)
//   2. No role yet → /onboarding/role
//   3. CA roles without an active workspace → their own portal
//   4. Workspace page-permission gate (defense-in-depth on full
//      loads; APIs are gated independently in tenant resolution)
//   5. Customer onboarding not complete → /onboarding
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isOnboardingComplete } from "@/services/onboardingService";
import { getWorkspaceContext } from "@/lib/workspace/context";
import {
  requiredPermissionForPath,
  hasWorkspacePermission,
  workspaceHomeFor,
} from "@/lib/workspace/permissions";
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

  // ── CA / Firm Admin / Admin: workspace (impersonation) mode ──
  if (user.userRole !== "CUSTOMER") {
    const ws = await getWorkspaceContext();

    if (!ws) {
      // No active workspace → this portal is not theirs.
      if (user.userRole === "ADMIN") redirect("/admin");
      if (user.userRole === "CA_FIRM_ADMIN") redirect("/firm");
      redirect("/ca");
    }

    // Page-level permission gate on full loads. Soft navigations are
    // still covered by the API gate + hidden nav items.
    const path = (await headers()).get("x-ws-path") ?? "";
    const required = requiredPermissionForPath(path);
    if (!hasWorkspacePermission(ws.permissions, required, ws.isSuperAdmin)) {
      redirect(workspaceHomeFor(ws.permissions, ws.isSuperAdmin));
    }

    const org = await prisma.organization.findUnique({
      where: { id: ws.organizationId },
      select: {
        name: true,
        businessProfile: { select: { businessName: true } },
      },
    });
    if (!org) redirect("/ca");

    return (
      <DashboardShell
        workspace={{
          organizationId: ws.organizationId,
          organizationName: org.businessProfile?.businessName ?? org.name,
          caName: user.name ?? user.email,
          role: ws.role,
          permissions: ws.permissions,
          isSuperAdmin: ws.isSuperAdmin,
        }}
      >
        {children}
      </DashboardShell>
    );
  }

  // ── Customer flow (unchanged) ─────────────────────────────────
  const done = await isOnboardingComplete(user.organizationId);
  if (!done) {
    redirect("/onboarding/customer");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
