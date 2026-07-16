import { guardModule } from "@/lib/auth/require-module";
import MonitoringSidebar from "@/components/monitoring/MonitoringSidebar";

export default async function MonitoringLayout({ children }: { children: React.ReactNode }) {
  const denied = await guardModule("monitoring");
  if (denied) return denied;

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <MonitoringSidebar />
      <div style={{ flex: 1, overflow: "auto", minWidth: 0, padding: "28px 32px" }}>{children}</div>
    </div>
  );
}
