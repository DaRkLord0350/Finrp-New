"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content" style={{ flex: 1 }}>
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="page-container animate-fade-in">{children}</main>
      </div>
    </div>
  );
}
