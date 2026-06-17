"use client";

import { formatDistanceToNow } from "date-fns";
import { Activity } from "lucide-react";
import type { ActivityEntry } from "./types";

const ACTION_META: Record<string, { label: string; color: string }> = {
  MEMBER_INVITED: { label: "invited", color: "#6366f1" },
  MEMBER_JOINED: { label: "joined the firm", color: "#10b981" },
  MEMBER_UPDATED: { label: "updated", color: "#0ea5e9" },
  MEMBER_DEACTIVATED: { label: "deactivated", color: "#ef4444" },
  MEMBER_REACTIVATED: { label: "reactivated", color: "#10b981" },
  MEMBERS_IMPORTED: { label: "imported team members", color: "#8b5cf6" },
  PERMISSIONS_UPDATED: { label: "updated permissions for", color: "#f59e0b" },
  INVITE_RESENT: { label: "resent invite to", color: "#6366f1" },
  INVITE_REVOKED: { label: "revoked invite for", color: "#ef4444" },
};

export function ActivityLog({ activity }: { activity: ActivityEntry[] }) {
  if (activity.length === 0) {
    return (
      <div className="section-card">
        <div className="empty-state">
          <Activity size={42} color="var(--text-muted)" />
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>No activity yet</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Team changes — invites, edits, permission updates — will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
      {activity.map((a, i) => {
        const meta = ACTION_META[a.action] ?? { label: a.action.toLowerCase().replace(/_/g, " "), color: "#94a3b8" };
        const imported = a.action === "MEMBERS_IMPORTED";
        const count = imported ? (a.metadata?.created as number | undefined) : undefined;
        return (
          <div
            key={a.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              borderTop: i === 0 ? "none" : "1px solid var(--border)",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, color: "var(--text-primary)" }}>
                <strong>{a.actorName ?? "Someone"}</strong>{" "}
                <span style={{ color: "var(--text-secondary)" }}>{meta.label}</span>{" "}
                {imported ? (
                  <strong>{count != null ? `${count} member${count !== 1 ? "s" : ""}` : ""}</strong>
                ) : (
                  a.targetEmail && <strong>{a.targetEmail}</strong>
                )}
              </p>
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
              {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
