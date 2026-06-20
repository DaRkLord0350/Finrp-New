import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { BarChart3, TrendingUp, Users2, ArrowUpRight, Repeat } from "lucide-react";
import { getSubscriptionAnalytics } from "@/lib/billing/analytics";
import { getPlan, formatPrice } from "@/lib/billing/plans";

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

  const [data, subs] = await Promise.all([getAnalytics(), getSubscriptionAnalytics()]);

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

      {/* ── Subscriptions & Revenue ─────────────────────────── */}
      <div style={{ marginTop: 40, marginBottom: 20 }}>
        <h2 className="section-title" style={{ fontSize: 18 }}>Subscriptions &amp; Revenue</h2>
        <p className="section-subtitle">Pricing model performance across CA firms and businesses</p>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
        <Kpi icon={<TrendingUp size={16} color="#10b981" />} label="Monthly recurring revenue" value={formatPrice(subs.totalMRR)} accent="#10b981" />
        <Kpi icon={<ArrowUpRight size={16} color="#f59e0b" />} label="Paid subscribers" value={String(subs.paidSubscribers)} accent="#f59e0b" />
        <Kpi icon={<Repeat size={16} color="#ec4899" />} label="Free organizations" value={String(subs.freeOrgs)} accent="#ec4899" />
        <Kpi icon={<Users2 size={16} color="#6366f1" />} label="CA firms" value={String(subs.caSubscriptions)} accent="#6366f1" />
        <Kpi icon={<BarChart3 size={16} color="#8b5cf6" />} label="Businesses" value={String(subs.businessSubscriptions)} accent="#8b5cf6" />
        <Kpi icon={<BarChart3 size={16} color="#0ea5e9" />} label="Connected businesses" value={String(subs.connectedBusinesses)} accent="#0ea5e9" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Revenue by plan */}
        <div className="section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <TrendingUp size={16} color="#10b981" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Revenue by Plan (MRR)</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {subs.revenueByPlan.map((r) => (
              <div key={r.planType} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)", width: 120, flexShrink: 0 }}>
                  {getPlan(r.planType).name}
                </span>
                <div style={{ flex: 1, height: 8, borderRadius: 99, background: "var(--bg-elevated)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${subs.totalMRR > 0 ? Math.round((r.mrr / subs.totalMRR) * 100) : 0}%`, background: "#10b981", borderRadius: 99 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#10b981", width: 84, textAlign: "right" }}>
                  {formatPrice(r.mrr)}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", width: 28, textAlign: "right" }}>×{r.subscribers}</span>
              </div>
            ))}
            {subs.totalMRR === 0 && (
              <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>No paid subscriptions yet</p>
            )}
          </div>
        </div>

        {/* Upgrade opportunities */}
        <div className="section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <ArrowUpRight size={16} color="#f59e0b" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Upgrade Opportunities</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Opportunity label="Free organizations" value={subs.upgradeOpportunities.freeOrgs} hint="→ Starter / Growth" />
            <Opportunity label="Free orgs near customer limit" value={subs.upgradeOpportunities.freeNearCustomerLimit} hint="→ upgrade for more customers" />
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 2 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Total active clients connected: </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{subs.totalActiveClients}</span>
            </div>
          </div>
        </div>
      </div>

      {/* CA utilization */}
      <div className="section-card" style={{ marginTop: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Users2 size={16} color="#6366f1" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>CA Utilization</h3>
          </div>
          {subs.avgCaUtilization !== null && (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Avg {subs.avgCaUtilization}% of capacity</span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {subs.caUtilization.slice(0, 10).map((ca) => (
            <div key={ca.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", width: 160, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {ca.name}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", width: 70, flexShrink: 0 }}>
                {ca.planType ? getPlan(ca.planType).name : "—"}
              </span>
              <div style={{ flex: 1, height: 8, borderRadius: 99, background: "var(--bg-elevated)", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${ca.pct === null ? 100 : Math.min(ca.pct, 100)}%`,
                    background: ca.pct === null ? "#6366f1" : ca.pct >= 90 ? "#ef4444" : ca.pct >= 75 ? "#f59e0b" : "#10b981",
                    borderRadius: 99,
                    opacity: ca.pct === null ? 0.4 : 1,
                  }}
                />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", width: 90, textAlign: "right" }}>
                {ca.active}/{ca.limit === null ? "∞" : ca.limit}
              </span>
            </div>
          ))}
          {subs.caUtilization.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>No CA firms yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="section-card" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        {icon}
        <span style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.3 }}>{label}</span>
      </div>
      <p style={{ fontSize: 24, fontWeight: 800, color: accent, letterSpacing: "-0.02em" }}>{value}</p>
    </div>
  );
}

function Opportunity({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</p>
        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{hint}</p>
      </div>
      <span style={{ fontSize: 20, fontWeight: 700, color: value > 0 ? "#f59e0b" : "var(--text-muted)" }}>{value}</span>
    </div>
  );
}
