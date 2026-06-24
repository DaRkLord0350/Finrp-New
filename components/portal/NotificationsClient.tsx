"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Bell, FileText, UploadCloud, BadgeCheck, XCircle, MessageSquare, CheckCheck } from "lucide-react";

export interface PortalNotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  createdAt: string;
}

const META: Record<string, { icon: React.ElementType; color: string }> = {
  DOCUMENT_REQUESTED: { icon: FileText, color: "#3b82f6" },
  DOCUMENT_UPLOADED: { icon: UploadCloud, color: "#8b5cf6" },
  FILING_APPROVAL_REQUESTED: { icon: BadgeCheck, color: "#f59e0b" },
  FILING_APPROVED: { icon: BadgeCheck, color: "#10b981" },
  FILING_REJECTED: { icon: XCircle, color: "#ef4444" },
  MESSAGE_RECEIVED: { icon: MessageSquare, color: "#0ea5e9" },
};

export function NotificationsClient({ initial }: { initial: PortalNotificationRow[] }) {
  const router = useRouter();
  const [items] = useState(initial);
  const [busy, setBusy] = useState(false);
  const unread = items.filter((n) => !n.isRead).length;

  async function markAllRead() {
    setBusy(true);
    try {
      await fetch("/api/portal/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="section-title">Notifications</h1>
          <p className="section-subtitle">{unread > 0 ? `${unread} unread` : "You're all caught up"}</p>
        </div>
        {unread > 0 && (
          <button className="btn-ghost" onClick={markAllRead} disabled={busy} style={{ fontSize: 13 }}>
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <Bell size={44} color="var(--text-muted)" />
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>No notifications</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", maxWidth: 320 }}>
              Document requests, approvals and messages from your CA will show up here.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((n) => {
            const meta = META[n.type] ?? { icon: Bell, color: "#6366f1" };
            const Icon = meta.icon;
            return (
              <div
                key={n.id}
                className="section-card"
                style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, opacity: n.isRead ? 0.65 : 1, borderLeft: n.isRead ? undefined : `3px solid ${meta.color}` }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${meta.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={17} color={meta.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{n.title}</p>
                  {n.body && <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{n.body}</p>}
                </div>
                <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{format(new Date(n.createdAt), "dd MMM · HH:mm")}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
