// ============================================================
// /ca/customers/assigned — the CA's client portfolio: every
// organization they hold an active ClientAssignment for, with
// permission scope and a one-click workspace launcher.
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import { Building2, Users, History } from "lucide-react";
import { listOpenableClients } from "@/lib/workspace/assignments";
import { PERMISSION_LABELS, WORKSPACE_PERMISSIONS } from "@/lib/workspace/permissions";
import OpenWorkspaceButton from "@/components/workspace/OpenWorkspaceButton";
import type { ClientPermission } from "@prisma/client";

export default async function AssignedCustomersPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (!user.userRole || user.userRole === "CUSTOMER") redirect("/dashboard");

  const clients = await listOpenableClients({
    id: user.id,
    userRole: user.userRole,
    firmId: user.firmId,
  });

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 className="section-title">Assigned Customers</h1>
          <p className="section-subtitle">
            {clients.length} client workspace{clients.length !== 1 ? "s" : ""} available
            {user.userRole === "ADMIN" && " (Super Admin — all clients)"}
          </p>
        </div>
        <Link
          href="/ca/customers/activity"
          className="btn-ghost"
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", fontSize: 13 }}
        >
          <History size={14} />
          Workspace Activity
        </Link>
      </div>

      {clients.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <Users size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
              No clients assigned yet
            </p>
            <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 340, textAlign: "center" }}>
              Ask your firm admin to assign customer organizations to your CA account.
              Once assigned, you can open their workspace from here.
            </p>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {clients.map((c) => {
            const bp = c.organization.businessProfile;
            const name = bp?.businessName ?? c.organization.name;
            const permissions = c.permissions as ClientPermission[];
            const fullAccess = permissions.length === WORKSPACE_PERMISSIONS.length;

            return (
              <div key={c.organization.id} className="section-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Card header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 11,
                      flexShrink: 0,
                      background: "linear-gradient(135deg, #6366f1, #0ea5e9)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Building2 size={19} color="white" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {name}
                    </p>
                    <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                      {bp?.businessType ?? "Business"}
                      {bp?.gstin ? ` · ${bp.gstin}` : ""}
                    </p>
                  </div>
                </div>

                {/* Permission chips */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {fullAccess ? (
                    <span
                      className="badge"
                      style={{
                        background: "rgba(16,185,129,0.1)",
                        color: "#10b981",
                        borderColor: "rgba(16,185,129,0.25)",
                        fontSize: 11,
                      }}
                    >
                      Full access
                    </span>
                  ) : (
                    permissions.map((p) => (
                      <span
                        key={p}
                        className="badge"
                        style={{
                          background: "rgba(99,102,241,0.1)",
                          color: "#818cf8",
                          borderColor: "rgba(99,102,241,0.25)",
                          fontSize: 11,
                        }}
                      >
                        {PERMISSION_LABELS[p]}
                      </span>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: "auto",
                    paddingTop: 4,
                  }}
                >
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    {c.assignedAt
                      ? `Assigned ${format(c.assignedAt, "dd MMM yyyy")}`
                      : "Super Admin access"}
                  </span>
                  <OpenWorkspaceButton organizationId={c.organization.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
