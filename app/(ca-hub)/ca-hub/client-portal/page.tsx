import { MonitorSmartphone, UploadCloud, BadgeCheck, MessageSquare } from "lucide-react";
import { ModuleLanding, Kpi } from "@/components/ca-hub/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { firmPortalStats } from "@/lib/client-portal/queries";

export default async function ClientPortalModule() {
  const user = await getCurrentUser().catch(() => null);
  const stats = user
    ? await firmPortalStats(user.organizationId)
    : { activeClients: 0, pendingUploads: 0, pendingApprovals: 0, unreadMessages: 0 };

  return (
    <ModuleLanding
      slug="client-portal"
      kpis={
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <Kpi label="Active Clients" value={stats.activeClients} icon={MonitorSmartphone} accent="#3b82f6" sub="with portal access" />
          <Kpi label="Pending Uploads" value={stats.pendingUploads} icon={UploadCloud} accent="#f59e0b" sub="open document requests" />
          <Kpi label="Approvals Waiting" value={stats.pendingApprovals} icon={BadgeCheck} accent="#8b5cf6" sub="filings to e-approve" />
          <Kpi label="Unread Messages" value={stats.unreadMessages} icon={MessageSquare} accent="#10b981" sub="from clients" />
        </div>
      }
    />
  );
}
