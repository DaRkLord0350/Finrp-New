import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import {
  Building2,
  Users,
  ShieldCheck,
  TrendingUp,
  Activity,
  UserCog,
  ClipboardList,
  AlertTriangle,
} from "lucide-react";

async function getAdminStats() {
  const [
    totalOrgs,
    totalUsers,
    totalCustomers,
    totalFirms,
    caUsers,
    firmAdmins,
    totalTasks,
    recentOrgs,
    recentUsers,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.customer.count({ where: { deletedAt: null } }),
    prisma.firm.count(),
    prisma.user.count({ where: { userRole: "CA" } }),
    prisma.user.count({ where: { userRole: "CA_FIRM_ADMIN" } }),
    prisma.firmTask.count(),
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, plan: true, createdAt: true, slug: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, name: true, email: true, userRole: true, role: true, createdAt: true },
    }),
  ]);

  return {
    totalOrgs,
    totalUsers,
    totalCustomers,
    totalFirms,
    caUsers,
    firmAdmins,
    totalTasks,
    recentOrgs,
    recentUsers,
  };
}

const roleColor: Record<string, string> = {
  ADMIN: "#6366f1",
  CA_FIRM_ADMIN: "#10b981",
  CA: "#0ea5e9",
  CUSTOMER: "#f59e0b",
};

const planColor: Record<string, string> = {
  FREE: "#94a3b8",
  STARTER: "#3b82f6",
  GROWTH: "#10b981",
  ENTERPRISE: "#6366f1",
};

export default async function AdminDashboardPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "ADMIN") redirect("/dashboard");

  const data = await getAdminStats();

  const metrics = [
    { label: "Total Organizations", value: data.totalOrgs, icon: Building2, color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
    { label: "Total Users", value: data.totalUsers, icon: Users, color: "#0ea5e9", bg: "rgba(14,165,233,0.1)" },
    { label: "CA Firms", value: data.totalFirms, icon: ShieldCheck, color: "#10b981", bg: "rgba(16,185,129,0.1)" },
    { label: "CA Users", value: data.caUsers, icon: UserCog, color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
    { label: "Firm Admins", value: data.firmAdmins, icon: TrendingUp, color: "#f97316", bg: "rgba(249,115,22,0.1)" },
    { label: "Total Customers", value: data.totalCustomers, icon: Users, color: "#8b5cf6", bg: "rgba(139,92,246,0.1)" },
    { label: "Active Tasks", value: data.totalTasks, icon: ClipboardList, color: "#ec4899", bg: "rgba(236,72,153,0.1)" },
    { label: "System Health", value: "100%", icon: Activity, color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  ];

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 className="section-title" style={{ fontSize: 24 }}>
          Platform Overview
        </h1>
        <p className="section-subtitle">
          {format(new Date(), "EEEE, dd MMMM yyyy")} · FinRP Admin Console
        </p>
      </div>

      {/* Metrics Grid */}
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

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>
        {/* Recent Organizations */}
        <div className="section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Building2 size={16} color="#6366f1" />
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              Recent Organizations
            </h2>
            <a href="/admin/firms" style={{ marginLeft: "auto", fontSize: 12, color: "var(--brand-400)", textDecoration: "none" }}>
              View all
            </a>
          </div>
          {data.recentOrgs.length === 0 ? (
            <div className="empty-state" style={{ padding: "32px 24px" }}>
              <Building2 size={32} color="var(--text-muted)" />
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No organizations yet</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Plan</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrgs.map((org) => (
                  <tr key={org.id}>
                    <td>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{org.name}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{org.slug}</p>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: `${planColor[org.plan]}18`,
                          color: planColor[org.plan],
                          borderColor: `${planColor[org.plan]}30`,
                        }}
                      >
                        {org.plan}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {format(org.createdAt, "dd MMM yyyy")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Users */}
        <div className="section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Users size={16} color="#0ea5e9" />
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              Recent Users
            </h2>
            <a href="/admin/users" style={{ marginLeft: "auto", fontSize: 12, color: "var(--brand-400)", textDecoration: "none" }}>
              View all
            </a>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {data.recentUsers.map((u) => (
              <div
                key={u.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: `${roleColor[u.userRole ?? "CUSTOMER"] ?? "#94a3b8"}20`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: roleColor[u.userRole ?? "CUSTOMER"] ?? "#94a3b8",
                    flexShrink: 0,
                  }}
                >
                  {(u.name ?? u.email).charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.name ?? u.email}
                  </p>
                  <p style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {format(u.createdAt, "dd MMM")}
                  </p>
                </div>
                <span
                  className="badge"
                  style={{
                    background: `${roleColor[u.userRole ?? "CUSTOMER"] ?? "#94a3b8"}18`,
                    color: roleColor[u.userRole ?? "CUSTOMER"] ?? "#94a3b8",
                    borderColor: `${roleColor[u.userRole ?? "CUSTOMER"] ?? "#94a3b8"}30`,
                    fontSize: 9,
                    flexShrink: 0,
                  }}
                >
                  {(u.userRole ?? "—").replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
          marginTop: 24,
        }}
      >
        {[
          { label: "Manage Firms", href: "/admin/firms", icon: Building2, color: "#6366f1" },
          { label: "Manage Users", href: "/admin/users", icon: UserCog, color: "#0ea5e9" },
          { label: "All Customers", href: "/admin/customers", icon: Users, color: "#10b981" },
          { label: "Compliance Overview", href: "/admin/compliance", icon: ShieldCheck, color: "#f59e0b" },
        ].map((link) => {
          const Icon = link.icon;
          return (
            <a
              key={link.href}
              href={link.href}
              style={{ textDecoration: "none" }}
            >
              <div
                className="stat-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "16px",
                  cursor: "pointer",
                  transition: "border-color 0.15s ease",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: `${link.color}18`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} color={link.color} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  {link.label}
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
