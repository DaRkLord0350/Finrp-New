import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import {
  ShieldCheck,
  UserCog,
  ClipboardList,
  Upload,
  MessageSquare,
  CheckCircle2,
  Clock,
} from "lucide-react";

async function getCustomerPortalData(orgId: string, userEmail: string) {
  const [caClients, submissions, tasks, messages] = await Promise.all([
    // CAs managing this organization
    prisma.cAClient.findMany({
      where: { organizationId: orgId, isActive: true },
      include: {
        caUser: { select: { id: true, name: true, email: true } },
      },
    }),
    // Compliance submissions for this org
    prisma.complianceSubmission.findMany({
      where: { organizationId: orgId, deletedAt: null },
      include: { category: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    // Firm tasks where customer's email matches a customer record
    prisma.firmTask.findMany({
      where: {
        customer: { email: userEmail },
        status: { not: "COMPLETED" },
      },
      include: {
        assignedCa: { select: { name: true, email: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    // Unread messages
    prisma.message.count({
      where: { receiverId: undefined, organizationId: orgId, isRead: false },
    }),
  ]);

  return { caClients, submissions, tasks, messages };
}

const statusColor: Record<string, string> = {
  DRAFT: "#94a3b8",
  SUBMITTED: "#3b82f6",
  UNDER_REVIEW: "#f59e0b",
  APPROVED: "#10b981",
  COMPLETED: "#10b981",
  REJECTED: "#ef4444",
  EXPIRED: "#ef4444",
  PENDING_RENEWAL: "#f97316",
};

export default async function CustomerPortalPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");

  const data = await getCustomerPortalData(user.organizationId, user.email);

  const completedSubs = data.submissions.filter((s) =>
    ["APPROVED", "COMPLETED"].includes(s.status)
  ).length;
  const totalSubs = data.submissions.length;
  const complianceScore = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 100;

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 32 }}>
        <h1 className="section-title" style={{ fontSize: 24 }}>
          CA Portal
        </h1>
        <p className="section-subtitle">
          Your compliance overview and CA relationship
        </p>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {[
          { label: "Compliance Score", value: `${complianceScore}%`, icon: ShieldCheck, color: complianceScore >= 80 ? "#10b981" : complianceScore >= 50 ? "#f59e0b" : "#ef4444", bg: "rgba(16,185,129,0.1)" },
          { label: "Assigned CAs", value: data.caClients.length, icon: UserCog, color: "#0ea5e9", bg: "rgba(14,165,233,0.1)" },
          { label: "Active Tasks", value: data.tasks.length, icon: ClipboardList, color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
          { label: "Compliance Items", value: totalSubs, icon: CheckCircle2, color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="stat-card">
              <div style={{ marginBottom: 12 }}>
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
              <p style={{ fontSize: 28, fontWeight: 700, color: m.color, lineHeight: 1 }}>{m.value}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{m.label}</p>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Pending Tasks */}
          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <ClipboardList size={16} color="#f59e0b" />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                Pending Tasks from Your CA
              </h2>
              <a href="/customer/tasks" style={{ marginLeft: "auto", fontSize: 12, color: "var(--brand-400)", textDecoration: "none" }}>View all</a>
            </div>
            {data.tasks.length === 0 ? (
              <div className="empty-state" style={{ padding: "24px" }}>
                <CheckCircle2 size={28} color="var(--success)" />
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No pending tasks</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.tasks.map((task) => (
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
                    <Clock size={14} color="#f59e0b" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {task.title}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {task.assignedCa.name ?? task.assignedCa.email}
                      </p>
                    </div>
                    <span style={{ fontSize: 11, color: "#f59e0b", flexShrink: 0 }}>
                      Due {format(task.dueDate, "dd MMM")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Compliance */}
          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <ShieldCheck size={16} color="#6366f1" />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                Compliance Status
              </h2>
              <a href="/customer/compliance" style={{ marginLeft: "auto", fontSize: 12, color: "var(--brand-400)", textDecoration: "none" }}>View all</a>
            </div>
            {data.submissions.length === 0 ? (
              <div className="empty-state" style={{ padding: "24px" }}>
                <ShieldCheck size={28} color="var(--text-muted)" />
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No compliance items yet</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Compliance</th>
                    <th>Category</th>
                    <th>Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.submissions.map((sub) => (
                    <tr key={sub.id}>
                      <td style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: 13 }}>{sub.title}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{sub.category.name}</td>
                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {sub.dueDate ? format(sub.dueDate, "dd MMM") : "—"}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: `${statusColor[sub.status]}18`,
                            color: statusColor[sub.status],
                            borderColor: `${statusColor[sub.status]}30`,
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
        </div>

        {/* Right — CA Info + Quick Links */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Assigned CAs */}
          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <UserCog size={16} color="#0ea5e9" />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                Your CAs
              </h2>
            </div>
            {data.caClients.length === 0 ? (
              <div className="empty-state" style={{ padding: "20px 16px" }}>
                <UserCog size={28} color="var(--text-muted)" />
                <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
                  No CA assigned yet
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.caClients.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "rgba(14,165,233,0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#0ea5e9",
                        flexShrink: 0,
                      }}
                    >
                      {(c.caUser.name ?? c.caUser.email).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {c.caUser.name ?? "—"}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.caUser.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="section-card">
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Quick Actions
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Upload Documents", href: "/customer/documents", icon: Upload, color: "#6366f1" },
                { label: "View Tasks", href: "/customer/tasks", icon: ClipboardList, color: "#f59e0b" },
                { label: "Send Message", href: "/customer/messages", icon: MessageSquare, color: "#0ea5e9" },
                { label: "Compliance Timeline", href: "/customer/compliance", icon: ShieldCheck, color: "#10b981" },
              ].map((link) => {
                const Icon = link.icon;
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      textDecoration: "none",
                      transition: "border-color 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: `${link.color}18`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={13} color={link.color} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      {link.label}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
