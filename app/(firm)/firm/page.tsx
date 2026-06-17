import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import {
  Users,
  UserCog,
  ClipboardList,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

const ACTIVITY_LABEL: Record<string, string> = {
  MEMBER_INVITED: "invited",
  MEMBER_JOINED: "joined",
  MEMBER_UPDATED: "updated member",
  MEMBER_DEACTIVATED: "deactivated",
  MEMBER_REACTIVATED: "reactivated",
  MEMBERS_IMPORTED: "imported members",
  PERMISSIONS_UPDATED: "updated permissions",
  INVITE_RESENT: "resent invite",
  INVITE_REVOKED: "revoked invite",
  CA_ASSIGNED: "assigned a CA",
  CA_REASSIGNED: "reassigned a CA",
  CA_UNASSIGNED: "removed an assignment",
  CUSTOMER_LINKED: "linked a customer",
  CUSTOMER_UNLINKED: "unlinked a customer",
};

async function getFirmDashboardData(userId: string, orgId: string) {
  const [
    totalCustomers,
    caUsers,
    activeTasks,
    pendingTasks,
    overdueTasksCount,
    recentTasks,
    upcomingDeadlines,
    recentCustomers,
    overdueByCustomer,
    recentActivity,
  ] = await Promise.all([
    prisma.customer.count({ where: { organizationId: orgId, deletedAt: null } }),
    prisma.user.count({ where: { organizationId: orgId, userRole: "CA" } }),
    prisma.firmTask.count({
      where: { organizationId: orgId, status: { in: ["IN_PROGRESS", "REVIEW"] } },
    }),
    prisma.firmTask.count({
      where: { organizationId: orgId, status: "PENDING" },
    }),
    prisma.firmTask.count({
      where: {
        organizationId: orgId,
        status: { not: "COMPLETED" },
        dueDate: { lt: new Date() },
      },
    }),
    prisma.firmTask.findMany({
      where: { organizationId: orgId },
      include: {
        customer: { select: { name: true } },
        assignedCa: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.firmTask.findMany({
      where: {
        organizationId: orgId,
        status: { not: "COMPLETED" },
        dueDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        customer: { select: { name: true } },
        assignedCa: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.customer.findMany({
      where: { organizationId: orgId, deletedAt: null },
      include: {
        _count: { select: { firmTasks: true, customerAssignments: { where: { isActive: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    // Customers with at least one overdue, open task → "at risk"
    prisma.firmTask.groupBy({
      by: ["customerId"],
      where: { organizationId: orgId, status: { not: "COMPLETED" }, dueDate: { lt: new Date() } },
    }),
    prisma.teamActivityLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 7,
    }),
  ]);

  return {
    totalCustomers,
    caUsers,
    activeTasks,
    pendingTasks,
    overdueTasksCount,
    recentTasks,
    upcomingDeadlines,
    recentCustomers,
    atRiskCustomers: overdueByCustomer.length,
    recentActivity,
  };
}

const statusColor: Record<string, string> = {
  PENDING: "#f59e0b",
  IN_PROGRESS: "#3b82f6",
  WAITING_CLIENT: "#f97316",
  REVIEW: "#8b5cf6",
  COMPLETED: "#10b981",
};

export default async function FirmDashboardPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "CA_FIRM_ADMIN") redirect("/dashboard");

  const data = await getFirmDashboardData(user.id, user.organizationId);

  const metrics = [
    { label: "Total Customers", value: data.totalCustomers, icon: Users, color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
    { label: "CA Team Members", value: data.caUsers, icon: UserCog, color: "#0ea5e9", bg: "rgba(14,165,233,0.1)" },
    { label: "Active Tasks", value: data.activeTasks, icon: ClipboardList, color: "#10b981", bg: "rgba(16,185,129,0.1)" },
    { label: "Pending Tasks", value: data.pendingTasks, icon: Clock, color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
    { label: "Overdue Tasks", value: data.overdueTasksCount, icon: AlertTriangle, color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
    { label: "Due This Week", value: data.upcomingDeadlines.length, icon: CalendarDays, color: "#f97316", bg: "rgba(249,115,22,0.1)" },
  ];

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 32 }}>
        <h1 className="section-title" style={{ fontSize: 24 }}>
          Firm Dashboard
        </h1>
        <p className="section-subtitle">
          {format(new Date(), "EEEE, dd MMMM yyyy")} · Practice Management
        </p>
      </div>

      {/* Metrics */}
      <div
        className="stagger"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {metrics.map((m) => {
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
              <p style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
                {m.value}
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{m.label}</p>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>
        {/* Recent Tasks */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Upcoming Deadlines */}
          {data.upcomingDeadlines.length > 0 && (
            <div className="section-card">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <CalendarDays size={16} color="#f97316" />
                <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                  Upcoming Deadlines
                </h2>
                <span
                  style={{
                    marginLeft: "auto",
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: "rgba(249,115,22,0.12)",
                    color: "#f97316",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {data.upcomingDeadlines.length} this week
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.upcomingDeadlines.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      background: "var(--bg-elevated)",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: statusColor[task.status],
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {task.title}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {task.customer.name} · {task.assignedCa.name ?? "Unassigned"}
                      </p>
                    </div>
                    <span style={{ fontSize: 11, color: "#f97316", flexShrink: 0 }}>
                      {format(task.dueDate, "dd MMM")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Tasks */}
          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <ClipboardList size={16} color="#6366f1" />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Recent Tasks</h2>
              <Link href="/firm/tasks" style={{ marginLeft: "auto", fontSize: 12, color: "var(--brand-400)", textDecoration: "none" }}>
                View all
              </Link>
            </div>
            {data.recentTasks.length === 0 ? (
              <div className="empty-state" style={{ padding: "32px 24px" }}>
                <ClipboardList size={32} color="var(--text-muted)" />
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No tasks yet</p>
                <Link href="/firm/tasks" style={{ fontSize: 12, color: "var(--brand-400)" }}>Create a task</Link>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Customer</th>
                    <th>CA</th>
                    <th>Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentTasks.map((task) => (
                    <tr key={task.id}>
                      <td style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: 13 }}>{task.title}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{task.customer.name}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{task.assignedCa.name ?? "—"}</td>
                      <td style={{ fontSize: 12, color: task.dueDate < new Date() && task.status !== "COMPLETED" ? "#ef4444" : "var(--text-muted)" }}>
                        {format(task.dueDate, "dd MMM")}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: `${statusColor[task.status]}18`,
                            color: statusColor[task.status],
                            borderColor: `${statusColor[task.status]}30`,
                          }}
                        >
                          {task.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right — Recent Customers */}
        <div>
          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={16} color="#6366f1" />
                <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Customers</h2>
              </div>
              <Link href="/firm/customers" style={{ fontSize: 12, color: "var(--brand-400)", textDecoration: "none" }}>
                View all
              </Link>
            </div>
            {data.recentCustomers.length === 0 ? (
              <div className="empty-state" style={{ padding: "24px 16px" }}>
                <Users size={28} color="var(--text-muted)" />
                <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
                  No customers yet
                </p>
                <Link href="/firm/customers" style={{ fontSize: 12, color: "var(--brand-400)" }}>Add customers</Link>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.recentCustomers.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                          {c._count.firmTasks} task{c._count.firmTasks !== 1 ? "s" : ""} ·{" "}
                          {c._count.customerAssignments > 0 ? "Assigned" : "Unassigned"}
                        </p>
                      </div>
                      {c._count.customerAssignments > 0 ? (
                        <CheckCircle2 size={14} color="#10b981" />
                      ) : (
                        <Clock size={14} color="#f59e0b" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compliance status + recent activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 24 }} className="firm-dash-bottom">
        <div className="section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <ShieldCheck size={16} color="#10b981" />
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Compliance Status</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              { label: "On Track", value: Math.max(0, data.totalCustomers - data.atRiskCustomers), color: "#10b981" },
              { label: "At Risk", value: data.atRiskCustomers, color: "#ef4444" },
              { label: "Overdue Tasks", value: data.overdueTasksCount, color: "#f59e0b" },
            ].map((s) => (
              <div key={s.label} style={{ padding: "14px 12px", background: "var(--bg-elevated)", borderRadius: 10, textAlign: "center" }}>
                <p style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Activity size={16} color="#6366f1" />
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Recent Activity</h2>
          </div>
          {data.recentActivity.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No recent activity.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {data.recentActivity.map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#6366f1", flexShrink: 0 }} />
                  <p style={{ flex: 1, fontSize: 12.5, color: "var(--text-secondary)", minWidth: 0 }}>
                    <strong style={{ color: "var(--text-primary)" }}>{a.actorName ?? "Someone"}</strong>{" "}
                    {ACTIVITY_LABEL[a.action] ?? a.action.toLowerCase().replace(/_/g, " ")}
                    {a.targetEmail ? ` · ${a.targetEmail}` : ""}
                  </p>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                    {formatDistanceToNow(a.createdAt, { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
