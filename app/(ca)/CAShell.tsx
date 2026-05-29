"use client";

import { useState } from "react";
import CASidebar from "@/components/ca/CASidebar";
import CAHeader from "@/components/ca/CAHeader";

export default function CAShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <CASidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <CAHeader onMenuClick={() => setSidebarOpen(true)} />
        <main>{children}</main>
      </div>
    </>
  );
}
