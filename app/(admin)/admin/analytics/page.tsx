import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";

async function getAnalytics() {
  const [
    orgsByPlan,
    usersByRole,
    tasksByStatus,
    orgGrowthLast30,
  ] = await Promise.all([
    prisma.organization.groupBy({ by: ["plan"], _count: { _all: true } }),
    prisma.user.groupBy({ by: ["userRole"], _count: { _all: true } }),
    prisma.firmTask.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.organization.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return { orgsByPlan, usersByRole, tasksByStatus, orgGrowthLast30 };
}

const planColor: Record<string, string> = { FREE: "#94a3b8", STARTER: "#3b82f6", GROWTH: "#10b981", ENTERPRISE: "#6366f1" };
const roleColor: Record<string, string> = { ADMIN: "#6366f1", CA_FIRM_ADMIN: "#10b981", CA: "#0ea5e9", CUSTOMER: "#f59e0b" };
const statusColor: Record<string, string> = { PENDING: "#f59e0b", IN_PROGRESS: "#3b82f6", WAITING_CLIENT: "#f97316", REVIEW: "#8b5cf6", COMPLETED: "#10b981" };

export default async function AdminAnalyticsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "ADMIN") redirect("/dashboard");

  const data = await getAnalytics();

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 className="section-title">Platform Analytics</h1>
        <p className="section-subtitle">Platform-wide usage metrics and trends</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
        {/* Organizations by Plan */}
        <div className="section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <BarChart3 size={16} color="#6366f1" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Organizations by Plan</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.orgsByPlan.map((item) => (
              <div key={item.plan} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)", width: 80, flexShrink: 0 }}>{item.plan}</span>
                <div style={{ flex: 1, height: 8, borderRadius: 99, background: "var(--bg-elevated)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min((item._count._all / 50) * 100, 100)}%`,
                      background: planColor[item.plan],
                      borderRadius: 99,
                    }}
                  />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: planColor[item.plan], width: 32, textAlign: "right" }}>
                  {item._count._all}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Users by Role */}
        <div className="section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <BarChart3 size={16} color="#0ea5e9" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Users by Role</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.usersByRole.map((item) => {
              const role = item.userRole ?? "UNKNOWN";
              return (
              <div key={role} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", width: 90, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {role.replace("_", " ")}
                </span>
                <div style={{ flex: 1, height: 8, borderRadius: 99, background: "var(--bg-elevated)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min((item._count._all / 100) * 100, 100)}%`,
                      background: roleColor[role] ?? "#94a3b8",
                      borderRadius: 99,
                    }}
                  />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: roleColor[role] ?? "#94a3b8", width: 32, textAlign: "right" }}>
                  {item._count._all}
                </span>
              </div>
              );
            })}
          </div>
        </div>

        {/* Tasks by Status */}
        <div className="section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <BarChart3 size={16} color="#10b981" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Tasks by Status</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.tasksByStatus.map((item) => (
              <div key={item.status} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", width: 90, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.status.replace("_", " ")}
                </span>
                <div style={{ flex: 1, height: 8, borderRadius: 99, background: "var(--bg-elevated)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min((item._count._all / 50) * 100, 100)}%`,
                      background: statusColor[item.status],
                      borderRadius: 99,
                    }}
                  />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: statusColor[item.status], width: 32, textAlign: "right" }}>
                  {item._count._all}
                </span>
              </div>
            ))}
            {data.tasksByStatus.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>No tasks yet</p>
            )}
          </div>
        </div>
      </div>

      <div className="section-card" style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
          New Organizations (Last 30 Days)
        </h3>
        <p style={{ fontSize: 32, fontWeight: 700, color: "#6366f1" }}>{data.orgGrowthLast30}</p>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>organizations joined in the last 30 days</p>
      </div>
    </div>
  );
}
