"use client";

import { useState } from "react";
import CAHubSidebar from "@/components/ca-hub/CAHubSidebar";
import CAHubHeader from "@/components/ca-hub/CAHubHeader";

export default function CAHubShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <CAHubSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <CAHubHeader onMenuClick={() => setSidebarOpen(true)} />
        <main>{children}</main>
      </div>
    </>
  );
}
