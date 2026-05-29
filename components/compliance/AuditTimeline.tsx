"use client";

import type { ComplianceAuditLogRecord, ComplianceStatusHistoryRecord } from "@/types/compliance";
import StatusBadge from "./StatusBadge";
import type { ComplianceStatus } from "@/types/compliance";

const ACTION_ICON: Record<string, string> = {
  CREATED: "✦",
  UPDATED: "✎",
  STATUS_CHANGED: "⇄",
  DOCUMENT_UPLOADED: "↑",
  DOCUMENT_DELETED: "✕",
  APPROVE: "✓",
  REJECT: "✗",
  REQUEST_CHANGES: "↺",
  ESCALATE: "↑",
  DELETED: "⊗",
};

const ACTION_COLOR: Record<string, string> = {
  CREATED: "#10b981",
  UPDATED: "#3b82f6",
  STATUS_CHANGED: "#f59e0b",
  DOCUMENT_UPLOADED: "#6366f1",
  DOCUMENT_DELETED: "#ef4444",
  APPROVE: "#10b981",
  REJECT: "#ef4444",
  REQUEST_CHANGES: "#f59e0b",
  ESCALATE: "#8b5cf6",
  DELETED: "#6b7280",
};

interface Props {
  auditLogs: ComplianceAuditLogRecord[];
  statusHistory?: ComplianceStatusHistoryRecord[];
}

export default function AuditTimeline({ auditLogs, statusHistory }: Props) {
  const formatDate = (d: string) =>
    new Date(d).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (auditLogs.length === 0 && (!statusHistory || statusHistory.length === 0)) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "24px",
          color: "var(--text-muted)",
          fontSize: 13,
        }}
      >
        No activity recorded yet
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {auditLogs.map((log, i) => {
        const color = ACTION_COLOR[log.action] ?? "#6b7280";
        const icon = ACTION_ICON[log.action] ?? "·";
        const isLast = i === auditLogs.length - 1;

        return (
          <div
            key={log.id}
            style={{ display: "flex", gap: 12, position: "relative" }}
          >
            {/* Timeline line */}
            {!isLast && (
              <div
                style={{
                  position: "absolute",
                  left: 15,
                  top: 28,
                  bottom: 0,
                  width: 1,
                  background: "var(--border)",
                }}
              />
            )}

            {/* Icon */}
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: `${color}18`,
                border: `1.5px solid ${color}40`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                color,
                flexShrink: 0,
                marginTop: 2,
                zIndex: 1,
              }}
            >
              {icon}
            </div>

            {/* Content */}
            <div style={{ flex: 1, paddingBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  {log.description}
                </p>
                <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                  {formatDate(log.createdAt)}
                </span>
              </div>

              {log.action === "STATUS_CHANGED" &&
                log.oldValue &&
                log.newValue &&
                typeof log.oldValue === "object" &&
                typeof log.newValue === "object" &&
                "status" in (log.oldValue as object) &&
                "status" in (log.newValue as object) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <StatusBadge
                      status={(log.oldValue as { status: string }).status as ComplianceStatus}
                      size="sm"
                    />
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>→</span>
                    <StatusBadge
                      status={(log.newValue as { status: string }).status as ComplianceStatus}
                      size="sm"
                    />
                  </div>
                )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
