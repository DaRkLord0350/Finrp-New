import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ShieldCheck } from "lucide-react";

async function getComplianceStats() {
  const [totalTasks, byStatus, recentTasks] = await Promise.all([
    prisma.firmTask.count(),
    prisma.firmTask.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.firmTask.findMany({
      include: {
        customer: { select: { name: true } },
        assignedCa: { select: { name: true, email: true } },
        organization: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return { totalTasks, byStatus, recentTasks };
}

const statusColor: Record<string, string> = {
  PENDING: "#f59e0b",
  IN_PROGRESS: "#3b82f6",
  WAITING_CLIENT: "#f97316",
  REVIEW: "#8b5cf6",
  COMPLETED: "#10b981",
};

export default async function AdminCompliancePage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "ADMIN") redirect("/dashboard");

  const data = await getComplianceStats();

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 className="section-title">Compliance Overview</h1>
        <p className="section-subtitle">Platform-wide compliance task management</p>
      </div>

      {/* Status breakdown */}
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16, marginBottom: 28 }}
      >
        {data.byStatus.map((s) => (
          <div key={s.status} className="stat-card">
            <p style={{ fontSize: 28, fontWeight: 700, color: statusColor[s.status] }}>{s._count._all}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              {s.status.replace("_", " ")}
            </p>
          </div>
        ))}
      </div>

      {data.recentTasks.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <ShieldCheck size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No tasks yet</p>
          </div>
        </div>
      ) : (
        <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Customer</th>
                <th>Assigned CA</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentTasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{task.title}</p>
                    {task.description && (
                      <p style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280, whiteSpace: "nowrap" }}>
                        {task.description}
                      </p>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{task.customer.name}</td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {task.assignedCa.name ?? task.assignedCa.email}
                  </td>
                  <td style={{ fontSize: 12, color: task.dueDate < new Date() && task.status !== "COMPLETED" ? "#ef4444" : "var(--text-muted)" }}>
                    {format(task.dueDate, "dd MMM yyyy")}
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
        </div>
      )}
    </div>
  );
}
