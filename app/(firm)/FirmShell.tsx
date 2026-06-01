"use client";

import { useState } from "react";
import FirmSidebar from "@/components/firm/FirmSidebar";
import FirmHeader from "@/components/firm/FirmHeader";

export default function FirmShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <FirmSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <FirmHeader onMenuClick={() => setSidebarOpen(true)} />
        <main>{children}</main>
      </div>
    </>
  );
}
