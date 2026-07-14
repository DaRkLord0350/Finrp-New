"use client";

import { useState } from "react";
import type { KycStatus, Role } from "@prisma/client";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { PermissionsProvider } from "@/components/auth/PermissionsProvider";
import { EntitlementsProvider } from "@/components/billing/EntitlementsProvider";
import { KycStatusProvider } from "@/components/kyc/KycStatusProvider";
import KycReadOnlyBanner from "@/components/kyc/KycReadOnlyBanner";
import ClientBanner, {
  type WorkspaceBannerData,
} from "@/components/workspace/ClientBanner";

export default function DashboardShell({
  children,
  workspace,
  role = null,
  permissions = [],
  entitlementFeatures = [],
  entitlementsLegacy = true,
  kycReadOnly = false,
  kycStatus = null,
}: {
  children: React.ReactNode;
  /** present only when a CA is impersonating a client (workspace mode) */
  workspace?: WorkspaceBannerData;
  /** current user's RBAC role (customer flow) */
  role?: Role | null;
  /** current user's resolved permission strings (customer flow) */
  permissions?: string[];
  /** plan entitlement feature flags for the tenant (lock-don't-hide UI) */
  entitlementFeatures?: string[];
  /** legacy/grandfathered org → everything unlocked */
  entitlementsLegacy?: boolean;
  /** Module 10 — true once KycProfile exists and status !== APPROVED (grandfathered orgs are always false) */
  kycReadOnly?: boolean;
  kycStatus?: KycStatus | null;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <PermissionsProvider role={role} permissions={permissions}>
      <EntitlementsProvider features={entitlementFeatures} isLegacy={entitlementsLegacy}>
      <KycStatusProvider isReadOnly={kycReadOnly} status={kycStatus}>
      <div
        className={workspace ? "workspace-shell" : undefined}
        style={{ display: "flex", minHeight: "100vh" }}
      >
        {workspace && <ClientBanner workspace={workspace} />}
        {/* SAME Sidebar component for customers and CA workspace sessions —
            no separate workspace nav. The banner above is the only visible
            difference while impersonating. */}
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          permissions={permissions}
        />
        <div className="main-content" style={{ flex: 1 }}>
          {kycReadOnly && <KycReadOnlyBanner status={kycStatus} />}
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
          <main className="page-container animate-fade-in">{children}</main>
        </div>
      </div>
      </KycStatusProvider>
      </EntitlementsProvider>
    </PermissionsProvider>
  );
}
