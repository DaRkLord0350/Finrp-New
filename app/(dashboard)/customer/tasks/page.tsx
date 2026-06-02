import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ClipboardList, CheckCircle2 } from "lucide-react";

async function getCustomerTasks(email: string) {
  return prisma.firmTask.findMany({
    where: { customer: { email } },
    include: {
      assignedCa: { select: { name: true, email: true } },
      customer: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });
}

const statusColor: Record<string, string> = {
  PENDING: "#f59e0b",
  IN_PROGRESS: "#3b82f6",
  WAITING_CLIENT: "#f97316",
  REVIEW: "#8b5cf6",
  COMPLETED: "#10b981",
};

const priorityColor: Record<string, string> = {
  LOW: "#94a3b8",
  MEDIUM: "#3b82f6",
  HIGH: "#f59e0b",
  CRITICAL: "#ef4444",
};

export default async function CustomerTasksPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");

  const tasks = await getCustomerTasks(user.email);

  const pending = tasks.filter((t) => t.status !== "COMPLETED").length;
  const completed = tasks.filter((t) => t.status === "COMPLETED").length;

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 className="section-title">My Tasks</h1>
        <p className="section-subtitle">Tasks assigned to you by your CA</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total Tasks", value: tasks.length, color: "#6366f1" },
          { label: "Pending / Active", value: pending, color: "#f59e0b" },
          { label: "Completed", value: completed, color: "#10b981" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {tasks.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <ClipboardList size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No tasks assigned</p>
            <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 300, textAlign: "center" }}>
              Your CA will assign tasks here when they need your action.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tasks.map((task) => (
            <div
              key={task.id}
              className="section-card"
              style={{ padding: "16px 20px", opacity: task.status === "COMPLETED" ? 0.65 : 1 }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    {task.status === "COMPLETED" ? (
                      <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
                    ) : (
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: statusColor[task.status],
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{task.title}</p>
                  </div>
                  {task.description && (
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>{task.description}</p>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      From: <span style={{ color: "var(--text-secondary)" }}>
                        {task.assignedCa.name ?? task.assignedCa.email}
                      </span>
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: new Date(task.dueDate) < new Date() && task.status !== "COMPLETED"
                          ? "#ef4444"
                          : "var(--text-muted)",
                      }}
                    >
                      Due: {format(task.dueDate, "dd MMM yyyy")}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
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
                  <span
                    className="badge"
                    style={{
                      background: `${priorityColor[task.priority]}18`,
                      color: priorityColor[task.priority],
                      borderColor: `${priorityColor[task.priority]}30`,
                    }}
                  >
                    {task.priority}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
