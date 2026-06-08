import type { ReactNode } from "react";
import ReportsSidebar from "./ReportsSidebar";

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <ReportsSidebar />
      <div style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
