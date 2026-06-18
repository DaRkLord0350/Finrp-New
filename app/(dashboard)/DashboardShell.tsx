"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { PermissionsProvider } from "@/components/auth/PermissionsProvider";
import ClientBanner, {
  type WorkspaceBannerData,
} from "@/components/workspace/ClientBanner";

export default function DashboardShell({
  children,
  workspace,
  role = null,
  permissions = [],
}: {
  children: React.ReactNode;
  /** present only when a CA is impersonating a client (workspace mode) */
  workspace?: WorkspaceBannerData;
  /** current user's RBAC role (customer flow) */
  role?: Role | null;
  /** current user's resolved permission strings (customer flow) */
  permissions?: string[];
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <PermissionsProvider role={role} permissions={permissions}>
      <div
        className={workspace ? "workspace-shell" : undefined}
        style={{ display: "flex", minHeight: "100vh" }}
      >
        {workspace && <ClientBanner workspace={workspace} />}
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          permissions={permissions}
          workspace={
            workspace
              ? {
                  clientName: workspace.organizationName,
                  permissions: workspace.permissions,
                  isSuperAdmin: workspace.isSuperAdmin,
                }
              : undefined
          }
        />
        <div className="main-content" style={{ flex: 1 }}>
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
          <main className="page-container animate-fade-in">{children}</main>
        </div>
      </div>
    </PermissionsProvider>
  );
}
