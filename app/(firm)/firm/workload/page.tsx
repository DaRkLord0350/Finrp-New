import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "date-fns";
import { Activity, Users, ClipboardList, AlertTriangle, AlertCircle } from "lucide-react";

async function getWorkloadData(orgId: string) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const caUsers = await prisma.user.findMany({
    where: { organizationId: orgId, userRole: "CA", isActive: true },
    select: { id: true, name: true, email: true },
  });

  const workloadData = await Promise.all(
    caUsers.map(async (ca) => {
      const [assignedClients, pendingTasks, inProgressTasks, completedThisMonth, overdueTasks] = await Promise.all([
        prisma.customerAssignment.count({ where: { caId: ca.id, isActive: true } }),
        prisma.firmTask.count({ where: { assignedCaId: ca.id, organizationId: orgId, status: "PENDING" } }),
        prisma.firmTask.count({ where: { assignedCaId: ca.id, organizationId: orgId, status: "IN_PROGRESS" } }),
        prisma.firmTask.count({ where: { assignedCaId: ca.id, organizationId: orgId, status: "COMPLETED", completedAt: { gte: monthStart, lte: monthEnd } } }),
        prisma.firmTask.count({ where: { assignedCaId: ca.id, organizationId: orgId, status: { not: "COMPLETED" }, dueDate: { lt: now } } }),
      ]);
      const activeTasks = pendingTasks + inProgressTasks;
      const workloadPct = Math.min(100, Math.round((activeTasks / 10) * 100));
      return { ca, assignedClients, pendingTasks, inProgressTasks, completedThisMonth, overdueTasks, activeTasks, workloadPct, isOverloaded: workloadPct >= 90 };
    })
  );

  const [totalCustomers, pendingAll, overdueAll] = await Promise.all([
    prisma.customer.count({ where: { organizationId: orgId, deletedAt: null } }),
    prisma.firmTask.count({ where: { organizationId: orgId, status: { in: ["PENDING", "IN_PROGRESS"] } } }),
    prisma.firmTask.count({ where: { organizationId: orgId, status: { not: "COMPLETED" }, dueDate: { lt: now } } }),
  ]);

  return { workloadData, caUsers, summary: { totalCAs: caUsers.length, totalCustomers, pendingAll, overdueAll, overloadedCAs: workloadData.filter((w) => w.isOverloaded).length } };
}

function WorkloadBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#10b981";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: "var(--bg-elevated)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width 0.3s ease" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, minWidth: 32, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

export default async function WorkloadPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "CA_FIRM_ADMIN") redirect("/dashboard");

  const { workloadData, summary } = await getWorkloadData(user.organizationId);

  const summaryCards = [
    { label: "Total CAs", value: summary.totalCAs, icon: Users, color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
    { label: "Total Clients", value: summary.totalCustomers, icon: Users, color: "#0ea5e9", bg: "rgba(14,165,233,0.1)" },
    { label: "Pending Tasks", value: summary.pendingAll, icon: ClipboardList, color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
    { label: "Overdue Tasks", value: summary.overdueAll, icon: AlertTriangle, color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
    { label: "CAs Overloaded", value: summary.overloadedCAs, icon: AlertCircle, color: "#f97316", bg: "rgba(249,115,22,0.1)" },
  ];

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 className="section-title">Workload Management</h1>
        <p className="section-subtitle">CA team capacity and task distribution</p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 28 }}>
        {summaryCards.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="stat-card">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: m.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={16} color={m.color} />
                </div>
              </div>
              <p style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{m.value}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{m.label}</p>
            </div>
          );
        })}
      </div>

      {/* Overload Alerts */}
      {workloadData.filter((w) => w.isOverloaded).map((w) => (
        <div key={w.ca.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, marginBottom: 12 }}>
          <AlertCircle size={16} color="#ef4444" />
          <p style={{ fontSize: 13, color: "#ef4444", fontWeight: 600 }}>
            Resource Allocation Warning: {w.ca.name ?? w.ca.email} is at {w.workloadPct}% capacity ({w.activeTasks} active tasks)
          </p>
        </div>
      ))}

      {/* Workload Table */}
      {workloadData.length === 0 ? (
        <div className="section-card"><div className="empty-state"><Activity size={40} color="var(--text-muted)" /><p style={{ color: "var(--text-muted)" }}>No CA team members found. Add CAs to your team.</p></div></div>
      ) : (
        <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>CA Name</th>
                <th>Assigned Clients</th>
                <th>Pending</th>
                <th>In Progress</th>
                <th>Completed (Month)</th>
                <th>Overdue</th>
                <th style={{ minWidth: 180 }}>Workload</th>
              </tr>
            </thead>
            <tbody>
              {workloadData.sort((a, b) => b.workloadPct - a.workloadPct).map((w) => (
                <tr key={w.ca.id} style={{ background: w.isOverloaded ? "rgba(239,68,68,0.03)" : undefined }}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {w.isOverloaded && <AlertCircle size={13} color="#ef4444" />}
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{w.ca.name ?? "—"}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{w.ca.email}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", textAlign: "center" }}>{w.assignedClients}</td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: w.pendingTasks > 0 ? "#f59e0b" : "var(--text-muted)" }}>{w.pendingTasks}</span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: w.inProgressTasks > 0 ? "#3b82f6" : "var(--text-muted)" }}>{w.inProgressTasks}</span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#10b981" }}>{w.completedThisMonth}</span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: w.overdueTasks > 0 ? "#ef4444" : "var(--text-muted)" }}>{w.overdueTasks}</span>
                  </td>
                  <td style={{ paddingRight: 20 }}>
                    <WorkloadBar pct={w.workloadPct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Heatmap */}
      <div className="section-card" style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Workload Heatmap</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {workloadData.map((w) => {
            const color = w.workloadPct >= 90 ? "#ef4444" : w.workloadPct >= 70 ? "#f59e0b" : w.workloadPct >= 40 ? "#3b82f6" : "#10b981";
            const opacity = Math.max(0.15, w.workloadPct / 100);
            return (
              <div key={w.ca.id} title={`${w.ca.name ?? w.ca.email}: ${w.workloadPct}%`}
                style={{ padding: "12px 16px", borderRadius: 10, background: `${color}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`, border: `1px solid ${color}40`, minWidth: 100, textAlign: "center" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color }}>{w.workloadPct}%</p>
                <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 90 }}>{w.ca.name ?? w.ca.email}</p>
                <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{w.activeTasks} active</p>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 11 }}>
          {[["#10b981", "Low (0-39%)"], ["#3b82f6", "Medium (40-69%)"], ["#f59e0b", "High (70-89%)"], ["#ef4444", "Overloaded (90%+)"]].map(([c, l]) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
              <span style={{ color: "var(--text-muted)" }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
