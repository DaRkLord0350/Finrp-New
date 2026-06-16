"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  ClipboardList,
  FileText,
  UserCheck,
  MessageSquare,
  ShieldCheck,
  CheckCheck,
  Settings,
} from "lucide-react";

interface Notif {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  referenceId: string | null;
  referenceType: string | null;
  createdAt: string;
}

const META: Record<string, { icon: typeof Bell; color: string }> = {
  TASK_ASSIGNED: { icon: ClipboardList, color: "#6366f1" },
  TASK_DUE: { icon: ClipboardList, color: "#f59e0b" },
  DOCUMENT_UPLOADED: { icon: FileText, color: "#0ea5e9" },
  DOCUMENT_APPROVED: { icon: FileText, color: "#10b981" },
  DOCUMENT_REJECTED: { icon: FileText, color: "#ef4444" },
  ASSIGNMENT_CREATED: { icon: UserCheck, color: "#10b981" },
  MESSAGE_RECEIVED: { icon: MessageSquare, color: "#8b5cf6" },
  COMPLIANCE_REMINDER: { icon: ShieldCheck, color: "#f97316" },
  SYSTEM: { icon: Bell, color: "#94a3b8" },
};

function hrefFor(n: Notif): string | null {
  if (!n.referenceId) return null;
  switch (n.referenceType) {
    case "firm_task":
      return `/firm/tasks/${n.referenceId}`;
    case "customer_assignment":
      return "/firm/assignments";
    case "customer_document":
      return "/firm/documents";
    default:
      return null;
  }
}

export default function FirmNotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/firm/notifications");
      const data = await res.json();
      setItems(data.notifications ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function open(n: Notif) {
    if (!n.isRead) {
      await fetch(`/api/firm/notifications/${n.id}/read`, { method: "POST" }).catch(() => {});
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    }
    const href = hrefFor(n);
    if (href) router.push(href);
  }

  async function markAll() {
    await fetch("/api/firm/notifications/read-all", { method: "POST" }).catch(() => {});
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
  }

  const shown = filter === "unread" ? items.filter((i) => !i.isRead) : items;
  const unread = items.filter((i) => !i.isRead).length;

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h1 className="section-title">Notifications</h1>
          <p className="section-subtitle">{unread} unread</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/firm/settings/notifications" style={toolBtn(false)}>
            <Settings size={14} /> Preferences
          </Link>
          <button onClick={markAll} disabled={unread === 0} style={{ ...toolBtn(true), opacity: unread === 0 ? 0.5 : 1 }}>
            <CheckCheck size={14} /> Mark all read
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px",
              borderRadius: 99,
              border: `1px solid ${filter === f ? "#6366f1" : "var(--border)"}`,
              background: filter === f ? "rgba(99,102,241,0.12)" : "transparent",
              color: filter === f ? "#6366f1" : "var(--text-secondary)",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {f} {f === "unread" ? `(${unread})` : `(${items.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="section-card"><div className="empty-state"><p style={{ fontSize: 14, color: "var(--text-muted)" }}>Loading…</p></div></div>
      ) : shown.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <Bell size={44} color="var(--text-muted)" />
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>You&apos;re all caught up</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No {filter === "unread" ? "unread " : ""}notifications.</p>
          </div>
        </div>
      ) : (
        <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
          {shown.map((n, i) => {
            const meta = META[n.type] ?? META.SYSTEM;
            const Icon = meta.icon;
            const clickable = !!hrefFor(n);
            return (
              <div
                key={n.id}
                onClick={() => open(n)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "14px 18px",
                  borderTop: i === 0 ? "none" : "1px solid var(--border)",
                  background: n.isRead ? "transparent" : "rgba(99,102,241,0.05)",
                  cursor: clickable ? "pointer" : "default",
                }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${meta.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={16} color={meta.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, fontWeight: n.isRead ? 500 : 700, color: "var(--text-primary)" }}>{n.title}</p>
                  <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 1 }}>{n.message}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {!n.isRead && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1", flexShrink: 0, marginTop: 6 }} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function toolBtn(primary: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "9px 14px",
    background: primary ? "#6366f1" : "var(--bg-elevated)",
    color: primary ? "white" : "var(--text-secondary)",
    border: primary ? "none" : "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
  };
}
