import { MonitorSmartphone, UploadCloud, BadgeCheck, MessageSquare } from "lucide-react";
import { ModuleLanding, Kpi } from "@/components/ca-hub/ui";
import { practiceKpis } from "@/lib/ca-hub/demo-data";

export default function ClientPortalModule() {
  return (
    <ModuleLanding
      slug="client-portal"
      kpis={
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <Kpi label="Active Clients" value={practiceKpis.activeClients} icon={MonitorSmartphone} accent="#3b82f6" sub="with portal access" />
          <Kpi label="Pending Uploads" value={38} icon={UploadCloud} accent="#f59e0b" sub="requested docs" />
          <Kpi label="Approvals Waiting" value={12} icon={BadgeCheck} accent="#8b5cf6" sub="returns to e-approve" />
          <Kpi label="Unread Messages" value={26} icon={MessageSquare} accent="#10b981" />
        </div>
      }
    />
  );
}
