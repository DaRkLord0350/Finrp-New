"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import ClientBanner, {
  type WorkspaceBannerData,
} from "@/components/workspace/ClientBanner";

export default function DashboardShell({
  children,
  workspace,
}: {
  children: React.ReactNode;
  /** present only when a CA is impersonating a client (workspace mode) */
  workspace?: WorkspaceBannerData;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div
      className={workspace ? "workspace-shell" : undefined}
      style={{ display: "flex", minHeight: "100vh" }}
    >
      {workspace && <ClientBanner workspace={workspace} />}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
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
  );
}
