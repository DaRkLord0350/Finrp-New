// ============================================================
// Dashboard layout — server + client hybrid.
//
// Two ways in:
//   CUSTOMER             → their own organization (unchanged).
//   CA / FIRM / ADMIN    → ONLY inside a validated Client
//                          Workspace (impersonation). Renders the
//                          EXACT SAME DashboardShell (sidebar, pages,
//                          APIs) as a real customer session — the
//                          only difference is the ClientBanner on top
//                          ("Viewing Customer Workspace" + Exit) and
//                          audit logging. See lib/workspace/context.ts.
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
import { resolveOnboardingEntry } from "@/lib/auth/onboarding-entry";
import { resolvePermissions } from "@/lib/auth/permission-resolver";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isOnboardingComplete } from "@/services/onboardingService";
import { isOrganizationActivated, getOrgEntitlements } from "@/lib/billing/guards";
import { toEntitlementsDTO } from "@/lib/billing/entitlements";
import { getKycReadOnlyState } from "@/lib/kyc/guards";
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

  // New users haven't picked a role yet → resolve their invitation
  // automatically (or fall back to the self-signup picker).
  if (!user.userRole) redirect((await resolveOnboardingEntry(user)).redirectTo);

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

    // The CA isn't a member of the client's org, so there's no
    // Owner/Staff/Viewer role to resolve — the firm assigning this CA
    // to the client IS the authorization, scoped only by the
    // ClientAssignment permission gate above. Render the SAME customer
    // shell a real OWNER session would get (full RBAC + the client's
    // own plan entitlements) so the workspace is indistinguishable
    // from the customer's own dashboard apart from the banner.
    const ent = toEntitlementsDTO(await getOrgEntitlements(ws.organizationId));
    // Module 10: a CA is subject to the client org's read-only KYC state
    // for general mutations too (impersonation must not bypass a client's
    // incomplete KYC) — the KYC wizard's own routes are separately gated
    // by the MANAGE_KYC workspace permission so a CA can still help.
    const kyc = await getKycReadOnlyState(ws.organizationId);

    return (
      <DashboardShell
        role="OWNER"
        permissions={["*"]}
        entitlementFeatures={ent.features}
        entitlementsLegacy={ent.isLegacy}
        kycReadOnly={kyc.readOnly}
        kycStatus={kyc.status}
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

  // ── Customer flow ─────────────────────────────────────────────
  const done = await isOnboardingComplete(user.organizationId);
  if (!done) {
    redirect("/onboarding/customer");
  }

  // Gate dashboard access until a plan is chosen + (if paid) activated.
  if (!(await isOrganizationActivated(user.organizationId))) {
    redirect("/onboarding/plan");
  }

  // Drive the dynamic sidebar + client permission gates from the
  // user's EFFECTIVE permissions (custom-role overrides → code defaults).
  // Server stays the source of truth; this is UX.
  const permissions = await resolvePermissions(user.organizationId, user.role);

  // Plan entitlements feed the "lock, don't hide" treatment for premium
  // features (Integrations, AI, …) in the sidebar + settings nav.
  const ent = toEntitlementsDTO(await getOrgEntitlements(user.organizationId));

  // Module 10 — read-only (not blocked) until KYC is APPROVED. Orgs with
  // no KycProfile row are grandfathered (readOnly: false) by
  // getKycReadOnlyState itself — they predate this feature and must never
  // be locked out by its rollout.
  const kyc = await getKycReadOnlyState(user.organizationId);

  return (
    <DashboardShell
      role={user.role}
      permissions={permissions}
      entitlementFeatures={ent.features}
      entitlementsLegacy={ent.isLegacy}
      kycReadOnly={kyc.readOnly}
      kycStatus={kyc.status}
    >
      {children}
    </DashboardShell>
  );
}
