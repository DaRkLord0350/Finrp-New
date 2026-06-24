import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { MonitorSmartphone, UploadCloud, BadgeCheck, MessageSquare } from "lucide-react";
import { firmPortalStats, listClientAccess } from "@/lib/client-portal/queries";

const statusColor: Record<string, string> = {
  ACTIVE: "#10b981",
  INVITED: "#f59e0b",
  SUSPENDED: "#ef4444",
};

export default async function FirmClientPortalPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "CA_FIRM_ADMIN") redirect("/dashboard");

  const [stats, clients] = await Promise.all([
    firmPortalStats(user.organizationId),
    listClientAccess(user.organizationId),
  ]);

  const kpis = [
    { label: "Active Clients", value: stats.activeClients, icon: MonitorSmartphone, color: "#3b82f6", sub: "with portal access" },
    { label: "Pending Uploads", value: stats.pendingUploads, icon: UploadCloud, color: "#f59e0b", sub: "open document requests" },
    { label: "Approvals Waiting", value: stats.pendingApprovals, icon: BadgeCheck, color: "#8b5cf6", sub: "filings to e-approve" },
    { label: "Unread Messages", value: stats.unreadMessages, icon: MessageSquare, color: "#10b981", sub: "from clients" },
  ];

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 className="section-title">Client Portal</h1>
        <p className="section-subtitle">Document collaboration, e-approvals and messaging across your clients</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        {kpis.map((k) => (
          <div key={k.label} className="stat-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <k.icon size={16} color={k.color} />
              <p style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</p>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{k.label}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
            Clients with portal access ({clients.length})
          </h2>
        </div>
        {clients.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <MonitorSmartphone size={40} color="var(--text-muted)" />
            <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", maxWidth: 360 }}>
              No clients have portal access yet. Access is granted automatically when a customer onboards,
              or via <strong>Invitations</strong>.
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Email</th>
                <th>Status</th>
                <th>Last Access</th>
                <th>Granted</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.customer.name}</p>
                    {c.customer.company && (
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.customer.company}</p>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{c.customer.email ?? "—"}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: `${statusColor[c.status]}18`,
                        color: statusColor[c.status],
                        borderColor: `${statusColor[c.status]}30`,
                      }}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {c.lastAccessAt ? format(c.lastAccessAt, "dd MMM yyyy") : "Never"}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{format(c.createdAt, "dd MMM yyyy")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
