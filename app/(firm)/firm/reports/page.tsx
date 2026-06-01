import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";

async function getFirmReports(orgId: string) {
  const [tasksByStatus, tasksByCA, customerCount, overdueCount, completedThisMonth] = await Promise.all([
    prisma.firmTask.groupBy({ by: ["status"], where: { organizationId: orgId }, _count: { _all: true } }),
    prisma.firmTask.groupBy({
      by: ["assignedCaId"],
      where: { organizationId: orgId, status: { not: "COMPLETED" } },
      _count: { _all: true },
    }),
    prisma.customer.count({ where: { organizationId: orgId, deletedAt: null } }),
    prisma.firmTask.count({
      where: { organizationId: orgId, status: { not: "COMPLETED" }, dueDate: { lt: new Date() } },
    }),
    prisma.firmTask.count({
      where: {
        organizationId: orgId,
        status: "COMPLETED",
        completedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
  ]);

  // Enrich tasksByCA with user names
  const caIds = tasksByCA.map((t) => t.assignedCaId);
  const caUsers = await prisma.user.findMany({
    where: { id: { in: caIds } },
    select: { id: true, name: true, email: true },
  });
  const caMap = Object.fromEntries(caUsers.map((u) => [u.id, u.name ?? u.email]));

  return { tasksByStatus, tasksByCA: tasksByCA.map((t) => ({ ...t, caName: caMap[t.assignedCaId] ?? "Unknown" })), customerCount, overdueCount, completedThisMonth };
}

const statusColor: Record<string, string> = {
  PENDING: "#f59e0b",
  IN_PROGRESS: "#3b82f6",
  WAITING_CLIENT: "#f97316",
  REVIEW: "#8b5cf6",
  COMPLETED: "#10b981",
};

export default async function FirmReportsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "CA_FIRM_ADMIN") redirect("/dashboard");

  const data = await getFirmReports(user.organizationId);
  const totalTasks = data.tasksByStatus.reduce((a, t) => a + t._count._all, 0);

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 className="section-title">Reports</h1>
        <p className="section-subtitle">Firm performance and compliance analytics</p>
      </div>

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total Customers", value: data.customerCount, color: "#6366f1" },
          { label: "Total Tasks", value: totalTasks, color: "#0ea5e9" },
          { label: "Overdue Tasks", value: data.overdueCount, color: "#ef4444" },
          { label: "Completed This Month", value: data.completedThisMonth, color: "#10b981" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Tasks by Status */}
        <div className="section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <BarChart3 size={16} color="#6366f1" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Tasks by Status</h3>
          </div>
          {data.tasksByStatus.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>No tasks yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {data.tasksByStatus.map((item) => {
                const pct = totalTasks > 0 ? (item._count._all / totalTasks) * 100 : 0;
                return (
                  <div key={item.status}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {item.status.replace("_", " ")}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: statusColor[item.status] }}>
                        {item._count._all}
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 99, background: "var(--bg-elevated)", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: statusColor[item.status],
                          borderRadius: 99,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Workload by CA */}
        <div className="section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <BarChart3 size={16} color="#0ea5e9" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Open Tasks by CA</h3>
          </div>
          {data.tasksByCA.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>No open tasks</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {data.tasksByCA.map((item) => {
                const maxCount = Math.max(...data.tasksByCA.map((t) => t._count._all));
                const pct = maxCount > 0 ? (item._count._all / maxCount) * 100 : 0;
                return (
                  <div key={item.assignedCaId}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                        {item.caName}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#0ea5e9" }}>
                        {item._count._all}
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 99, background: "var(--bg-elevated)", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: "#0ea5e9",
                          borderRadius: 99,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
