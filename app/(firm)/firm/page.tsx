import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  Users,
  UserCog,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  UserMinus,
  Rocket,
  Activity,
} from "lucide-react";
import { getFirmDashboard } from "@/lib/firm/dashboard";
import DashboardCharts from "@/components/firm/dashboard/DashboardCharts";

export const dynamic = "force-dynamic";

const ACTIVITY_LABEL: Record<string, string> = {
  MEMBER_INVITED: "invited a team member",
  MEMBER_JOINED: "joined the firm",
  MEMBER_UPDATED: "updated a member",
  MEMBER_DEACTIVATED: "deactivated a member",
  MEMBER_REACTIVATED: "reactivated a member",
  MEMBERS_IMPORTED: "imported members",
  PERMISSIONS_UPDATED: "updated permissions",
  INVITE_RESENT: "resent an invite",
  INVITE_REVOKED: "revoked an invite",
  CA_ASSIGNED: "assigned a customer",
  CA_REASSIGNED: "reassigned a customer",
  CA_UNASSIGNED: "removed an assignment",
  CUSTOMER_LINKED: "linked a customer",
  CUSTOMER_UNLINKED: "unlinked a customer",
};

export default async function FirmDashboardPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "CA_FIRM_ADMIN") redirect("/dashboard");

  const { metrics, customerGrowth, taskCompletion, caWorkload, activity } = await getFirmDashboard(
    user.organizationId
  );

  const orgName = await prisma.organization
    .findUnique({
      where: { id: user.organizationId },
      select: { name: true, businessProfile: { select: { businessName: true } } },
    })
    .then((o) => o?.businessProfile?.businessName ?? o?.name ?? "Your firm");

  const cards = [
    { label: "Total Team Members", value: metrics.totalTeamMembers, icon: Users, color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
    { label: "Active CAs", value: metrics.activeCas, icon: UserCog, color: "#0ea5e9", bg: "rgba(14,165,233,0.1)" },
    { label: "Total Customers", value: metrics.totalCustomers, icon: Users, color: "#8b5cf6", bg: "rgba(139,92,246,0.1)" },
    { label: "Unassigned Customers", value: metrics.unassignedCustomers, icon: UserMinus, color: "#f97316", bg: "rgba(249,115,22,0.1)" },
    { label: "Pending Onboardings", value: metrics.pendingOnboardings, icon: Rocket, color: "#eab308", bg: "rgba(234,179,8,0.1)" },
    { label: "Open Tasks", value: metrics.openTasks, icon: ClipboardList, color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
    { label: "Overdue Tasks", value: metrics.overdueTasks, icon: AlertTriangle, color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
    { label: "Completed Tasks", value: metrics.completedTasks, icon: CheckCircle2, color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  ];

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 className="section-title" style={{ fontSize: 24 }}>{orgName}</h1>
        <p className="section-subtitle">
          {format(new Date(), "EEEE, dd MMMM yyyy")} · Practice Dashboard
        </p>
      </div>

      {/* Metrics */}
      <div
        className="stagger"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        {cards.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="stat-card animate-fade-in">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: m.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={18} color={m.color} />
                </div>
              </div>
              <p style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{m.value}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{m.label}</p>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <DashboardCharts
        customerGrowth={customerGrowth}
        taskCompletion={taskCompletion}
        caWorkload={caWorkload}
      />

      {/* Recent activity */}
      <div className="section-card">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Activity size={16} color="#6366f1" />
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Recent Activity</h2>
          <Link href="/firm/team" style={{ marginLeft: "auto", fontSize: 12, color: "var(--brand-400)", textDecoration: "none" }}>
            View team
          </Link>
        </div>
        {activity.length === 0 ? (
          <div className="empty-state" style={{ padding: "28px 24px" }}>
            <Activity size={28} color="var(--text-muted)" />
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No recent activity yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {activity.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#6366f1", flexShrink: 0 }} />
                <p style={{ flex: 1, fontSize: 12.5, color: "var(--text-secondary)", minWidth: 0 }}>
                  <strong style={{ color: "var(--text-primary)" }}>{a.actorName ?? "Someone"}</strong>{" "}
                  {ACTIVITY_LABEL[a.action] ?? a.action.toLowerCase().replace(/_/g, " ")}
                  {a.targetEmail ? ` · ${a.targetEmail}` : ""}
                </p>
                <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                  {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
