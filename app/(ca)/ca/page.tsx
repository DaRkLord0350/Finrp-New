import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatDistanceToNow, format, isToday, isThisWeek } from "date-fns";
import {
  Users,
  ShieldCheck,
  FileCheck,
  AlertTriangle,
  Clock,
  TrendingUp,
  FileText,
  CheckCircle2,
  XCircle,
  Upload,
  CalendarDays,
} from "lucide-react";

// ── Data fetching ─────────────────────────────────────────────

async function getCADashboardData(caUserId: string) {
  const [
    caClients,
    pendingDocs,
    overdueSubmissions,
    dueTodaySubmissions,
    dueThisWeekSubmissions,
    recentActivity,
  ] = await Promise.all([
    // All managed client orgs
    prisma.cAClient.findMany({
      where: { caUserId, isActive: true },
      include: {
        organization: {
          include: {
            businessProfile: true,
            complianceSubmissions: {
              where: { deletedAt: null },
              select: { status: true, dueDate: true },
            },
          },
        },
      },
    }),

    // Documents waiting for CA review (PENDING)
    prisma.complianceDocument.count({
      where: {
        reviewStatus: "PENDING",
        submission: {
          organization: {
            caClients: { some: { caUserId } },
          },
        },
      },
    }),

    // Overdue filings across all client orgs
    prisma.complianceSubmission.count({
      where: {
        deletedAt: null,
        status: { notIn: ["APPROVED", "COMPLETED"] },
        dueDate: { lt: new Date() },
        organization: {
          caClients: { some: { caUserId } },
        },
      },
    }),

    // Due today
    prisma.complianceSubmission.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ["APPROVED", "COMPLETED"] },
        dueDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lte: new Date(new Date().setHours(23, 59, 59, 999)),
        },
        organization: {
          caClients: { some: { caUserId } },
        },
      },
      include: { organization: { include: { businessProfile: true } } },
      take: 5,
      orderBy: { dueDate: "asc" },
    }),

    // Due this week
    prisma.complianceSubmission.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ["APPROVED", "COMPLETED"] },
        dueDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        organization: {
          caClients: { some: { caUserId } },
        },
      },
      include: {
        organization: { include: { businessProfile: true } },
        category: { select: { name: true } },
      },
      take: 10,
      orderBy: { dueDate: "asc" },
    }),

    // Recent compliance documents uploaded (recent activity)
    prisma.complianceDocument.findMany({
      where: {
        submission: {
          organization: {
            caClients: { some: { caUserId } },
          },
        },
      },
      include: {
        submission: {
          include: {
            organization: { include: { businessProfile: true } },
            category: { select: { name: true } },
          },
        },
      },
      orderBy: { uploadedAt: "desc" },
      take: 8,
    }),
  ]);

  const totalClients = caClients.length;
  const activeCompliances = caClients.reduce(
    (acc, c) => acc + c.organization.complianceSubmissions.length,
    0
  );

  return {
    totalClients,
    activeCompliances,
    pendingDocs,
    overdueSubmissions,
    dueTodayCount: dueTodaySubmissions.length,
    dueThisWeekCount: dueThisWeekSubmissions.length,
    dueToday: dueTodaySubmissions,
    dueThisWeek: dueThisWeekSubmissions,
    recentActivity,
    caClients,
  };
}

// ── Helpers ───────────────────────────────────────────────────

function statusColor(status: string) {
  const map: Record<string, string> = {
    DRAFT: "#94a3b8",
    SUBMITTED: "#3b82f6",
    UNDER_REVIEW: "#f59e0b",
    APPROVED: "#10b981",
    COMPLETED: "#10b981",
    REJECTED: "#ef4444",
    EXPIRED: "#ef4444",
    PENDING_RENEWAL: "#f97316",
  };
  return map[status] ?? "#94a3b8";
}

function reviewStatusColor(status: string) {
  const map: Record<string, string> = {
    PENDING: "#f59e0b",
    APPROVED: "#10b981",
    REJECTED: "#ef4444",
    CHANGES_REQUESTED: "#f97316",
  };
  return map[status] ?? "#94a3b8";
}

// ── Page ──────────────────────────────────────────────────────

export default async function CADashboardPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  const data = await getCADashboardData(user.id);

  const metrics = [
    {
      label: "Total Clients",
      value: data.totalClients,
      icon: Users,
      color: "#6366f1",
      bg: "rgba(99,102,241,0.1)",
    },
    {
      label: "Active Compliances",
      value: data.activeCompliances,
      icon: ShieldCheck,
      color: "#0ea5e9",
      bg: "rgba(14,165,233,0.1)",
    },
    {
      label: "Pending Verification",
      value: data.pendingDocs,
      icon: FileText,
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.1)",
    },
    {
      label: "Due Today",
      value: data.dueTodayCount,
      icon: Clock,
      color: "#ef4444",
      bg: "rgba(239,68,68,0.1)",
    },
    {
      label: "Due This Week",
      value: data.dueThisWeekCount,
      icon: CalendarDays,
      color: "#f97316",
      bg: "rgba(249,115,22,0.1)",
    },
    {
      label: "Overdue Filings",
      value: data.overdueSubmissions,
      icon: AlertTriangle,
      color: "#dc2626",
      bg: "rgba(220,38,38,0.1)",
    },
  ];

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 className="section-title" style={{ fontSize: 24 }}>
          Good {getTimeGreeting()}, {user.name?.split(" ")[0] ?? "CA"}
        </h1>
        <p className="section-subtitle">
          Here's what needs your attention today — {format(new Date(), "EEEE, dd MMMM yyyy")}
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
        {/* Left — Priority queue + Recent Activity */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Due Today */}
          {data.dueToday.length > 0 && (
            <div className="section-card">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Clock size={16} color="#ef4444" />
                <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                  Due Today
                </h2>
                <span
                  style={{
                    marginLeft: "auto",
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: "rgba(239,68,68,0.12)",
                    color: "#ef4444",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {data.dueTodayCount} item{data.dueTodayCount !== 1 ? "s" : ""}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.dueToday.map((sub) => (
                  <div
                    key={sub.id}
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
                        background: statusColor(sub.status),
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {sub.title}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {sub.organization.businessProfile?.businessName ?? sub.organization.name}
                      </p>
                    </div>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 99,
                        background: `${statusColor(sub.status)}18`,
                        color: statusColor(sub.status),
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        flexShrink: 0,
                      }}
                    >
                      {sub.status.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Due This Week */}
          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <CalendarDays size={16} color="#f97316" />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                Due This Week
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
                {data.dueThisWeekCount} total
              </span>
            </div>
            {data.dueThisWeek.length === 0 ? (
              <div className="empty-state" style={{ padding: "32px 24px" }}>
                <CheckCircle2 size={32} color="var(--success)" />
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                  No deadlines this week
                </p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Compliance</th>
                    <th>Client</th>
                    <th>Category</th>
                    <th>Due Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dueThisWeek.map((sub) => (
                    <tr key={sub.id}>
                      <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                        {sub.title}
                      </td>
                      <td>
                        {sub.organization.businessProfile?.businessName ?? sub.organization.name}
                      </td>
                      <td>{sub.category.name}</td>
                      <td>
                        <span style={{ color: isToday(sub.dueDate!) ? "#ef4444" : "var(--text-secondary)" }}>
                          {sub.dueDate ? format(sub.dueDate, "dd MMM") : "—"}
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: `${statusColor(sub.status)}18`,
                            color: statusColor(sub.status),
                            borderColor: `${statusColor(sub.status)}30`,
                          }}
                        >
                          {sub.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Recent Activity */}
          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <TrendingUp size={16} color="var(--brand-400)" />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                Recent Activity
              </h2>
            </div>
            {data.recentActivity.length === 0 ? (
              <div className="empty-state" style={{ padding: "32px 24px" }}>
                <Upload size={32} color="var(--text-muted)" />
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                  No recent document activity
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {data.recentActivity.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "12px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: `${reviewStatusColor(doc.reviewStatus)}18`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {doc.reviewStatus === "APPROVED" ? (
                        <CheckCircle2 size={15} color="#10b981" />
                      ) : doc.reviewStatus === "REJECTED" ? (
                        <XCircle size={15} color="#ef4444" />
                      ) : (
                        <Upload size={15} color="#f59e0b" />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {doc.fileName}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                        {doc.submission?.organization.businessProfile?.businessName ??
                          doc.submission?.organization.name ??
                          "Unknown"}{" "}
                        · {doc.submission?.category.name}
                      </p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <span
                        className="badge"
                        style={{
                          background: `${reviewStatusColor(doc.reviewStatus)}18`,
                          color: reviewStatusColor(doc.reviewStatus),
                          borderColor: `${reviewStatusColor(doc.reviewStatus)}30`,
                          marginBottom: 4,
                          display: "block",
                        }}
                      >
                        {doc.reviewStatus.replace("_", " ")}
                      </span>
                      <p style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        {formatDistanceToNow(doc.uploadedAt, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — Client list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={16} color="#6366f1" />
                <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                  My Clients
                </h2>
              </div>
              <a href="/ca/clients" style={{ fontSize: 12, color: "var(--brand-400)", textDecoration: "none" }}>
                View all
              </a>
            </div>
            {data.caClients.length === 0 ? (
              <div className="empty-state" style={{ padding: "32px 16px" }}>
                <Users size={32} color="var(--text-muted)" />
                <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
                  No clients assigned yet
                </p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
                  Ask your admin to assign client organizations
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.caClients.slice(0, 8).map((c) => {
                  const totalSubmissions = c.organization.complianceSubmissions.length;
                  const overdue = c.organization.complianceSubmissions.filter(
                    (s) => s.dueDate && s.dueDate < new Date() && !["APPROVED", "COMPLETED"].includes(s.status)
                  ).length;
                  return (
                    <a
                      key={c.id}
                      href={`/ca/client/${c.organizationId}`}
                      style={{ textDecoration: "none" }}
                    >
                      <div
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          background: "var(--bg-elevated)",
                          border: "1px solid var(--border)",
                          transition: "border-color 0.15s ease",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                              {c.organization.businessProfile?.businessName ?? c.organization.name}
                            </p>
                            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                              {totalSubmissions} compliance{totalSubmissions !== 1 ? "s" : ""}
                            </p>
                          </div>
                          {overdue > 0 && (
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 99,
                                background: "rgba(239,68,68,0.12)",
                                color: "#ef4444",
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              {overdue} overdue
                            </span>
                          )}
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}
