import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Bell, Upload, AlertTriangle, FileCheck, Clock, Users, RefreshCw } from "lucide-react";

async function getCANotifications(caUserId: string) {
  // Use the org-level notifications for orgs this CA manages
  const orgIds = await prisma.cAClient.findMany({
    where: { caUserId, isActive: true },
    select: { organizationId: true },
  }).then((r) => r.map((c) => c.organizationId));

  if (orgIds.length === 0) return [];

  return prisma.notification.findMany({
    where: {
      organizationId: { in: orgIds },
      type: { in: ["COMPLIANCE_REMINDER", "TASK_ASSIGNED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

function notifIcon(type: string) {
  const map: Record<string, React.ReactNode> = {
    COMPLIANCE_REMINDER: <Clock size={16} color="#f59e0b" />,
    TASK_ASSIGNED: <Users size={16} color="#6366f1" />,
    SYSTEM: <Bell size={16} color="#94a3b8" />,
  };
  return map[type] ?? <Bell size={16} color="#94a3b8" />;
}

function notifIconBg(type: string) {
  const map: Record<string, string> = {
    COMPLIANCE_REMINDER: "rgba(245,158,11,0.1)",
    TASK_ASSIGNED: "rgba(99,102,241,0.1)",
    SYSTEM: "rgba(148,163,184,0.1)",
  };
  return map[type] ?? "rgba(148,163,184,0.1)";
}

// Simulate CA-specific notification types from doc uploads etc.
const CA_NOTIFICATION_TYPES = [
  { icon: Upload, label: "New Document Upload", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  { icon: AlertTriangle, label: "Deadline Approaching", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  { icon: RefreshCw, label: "Document Resubmitted", color: "#f97316", bg: "rgba(249,115,22,0.1)" },
  { icon: FileCheck, label: "Filing Completed", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
];

export default async function CANotificationsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  const notifications = await getCANotifications(user.id);
  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 className="section-title">Notifications</h1>
          <p className="section-subtitle">
            {unread > 0 ? (
              <span>
                <span style={{ color: "var(--brand-400)", fontWeight: 600 }}>{unread} unread</span> notifications
              </span>
            ) : (
              "All caught up"
            )}
          </p>
        </div>
        {unread > 0 && (
          <button className="btn-ghost" style={{ fontSize: 12 }}>
            Mark all read
          </button>
        )}
      </div>

      {/* Notification type legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
        {CA_NOTIFICATION_TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                background: t.bg,
                border: `1px solid ${t.color}20`,
              }}
            >
              <Icon size={13} color={t.color} />
              <span style={{ fontSize: 12, color: t.color, fontWeight: 500 }}>{t.label}</span>
            </div>
          );
        })}
      </div>

      {notifications.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <Bell size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No notifications</p>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              Notifications about client activity will appear here
            </p>
          </div>
        </div>
      ) : (
        <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
          {notifications.map((n, i) => (
            <div
              key={n.id}
              style={{
                padding: "14px 20px",
                borderBottom: i < notifications.length - 1 ? "1px solid var(--border)" : "none",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                background: !n.isRead ? "rgba(99,102,241,0.03)" : "transparent",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: notifIconBg(n.type),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {notifIcon(n.type)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: !n.isRead ? 600 : 500, color: "var(--text-primary)" }}>
                    {n.title}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {!n.isRead && (
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand-400)" }} />
                    )}
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {formatDistanceToNow(n.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {n.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
