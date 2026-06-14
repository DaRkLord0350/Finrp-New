// ============================================================
// /ca/customers/activity — the Client Workspace audit trail.
//
//   ADMIN          → all activity across every client
//   CA / FIRM      → their own workspace activity
//
// Backed by ClientActivityLog (lib/workspace/audit.ts) which
// records session boundaries, every API mutation performed while
// impersonating, permission denials and assignment changes.
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { History } from "lucide-react";
import { getClientActivity } from "@/lib/workspace/audit";
import type { ClientActivityAction } from "@prisma/client";

const ACTION_STYLES: Record<ClientActivityAction, { label: string; color: string; bg: string }> = {
  WORKSPACE_ENTER:     { label: "Entered",        color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  WORKSPACE_EXIT:      { label: "Exited",          color: "#64748b", bg: "rgba(100,116,139,0.12)" },
  WORKSPACE_SWITCH:    { label: "Switched",        color: "#0ea5e9", bg: "rgba(14,165,233,0.1)" },
  VIEW:                { label: "Viewed",          color: "#818cf8", bg: "rgba(99,102,241,0.1)" },
  CREATE:              { label: "Created",         color: "#6366f1", bg: "rgba(99,102,241,0.12)" },
  UPDATE:              { label: "Updated",         color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  DELETE:              { label: "Deleted",         color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  EXPORT:              { label: "Exported",        color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  PERMISSION_DENIED:   { label: "Denied",          color: "#dc2626", bg: "rgba(220,38,38,0.12)" },
  ASSIGNMENT_CREATED:  { label: "Assigned",        color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  ASSIGNMENT_UPDATED:  { label: "Assign. updated", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  ASSIGNMENT_REVOKED:  { label: "Revoked",         color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
};

export default async function WorkspaceActivityPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (!user.userRole || user.userRole === "CUSTOMER") redirect("/dashboard");

  const { items } = await getClientActivity({
    caUserId: user.userRole === "ADMIN" ? undefined : user.id,
    limit: 100,
  });

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 className="section-title">Workspace Activity</h1>
        <p className="section-subtitle">
          {user.userRole === "ADMIN"
            ? "All client-workspace activity across the platform"
            : "Your audited actions inside client workspaces"}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <History size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
              No workspace activity yet
            </p>
            <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 340, textAlign: "center" }}>
              Activity is recorded automatically when a client workspace is opened and
              whenever changes are made on behalf of a client.
            </p>
          </div>
        </div>
      ) : (
        <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                {user.userRole === "ADMIN" && <th>CA</th>}
                <th>Client</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {items.map((log) => {
                const style = ACTION_STYLES[log.action];
                return (
                  <tr key={log.id}>
                    <td style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {format(log.createdAt, "dd MMM yyyy, HH:mm")}
                    </td>
                    {user.userRole === "ADMIN" && (
                      <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                        {log.caUser.name ?? log.caUser.email}
                      </td>
                    )}
                    <td style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>
                      {log.organization.name}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: style.bg,
                          color: style.color,
                          borderColor: `${style.color}30`,
                          fontSize: 11,
                        }}
                      >
                        {style.label}
                      </span>
                    </td>
                    <td>
                      <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{log.summary}</p>
                      {log.path && (
                        <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                          {log.method ? `${log.method} ` : ""}
                          {log.path}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
