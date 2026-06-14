// ============================================================
// /ca/customers/all — directory of every customer organization.
//
//   ADMIN          → can open ANY client workspace (super admin)
//   CA / FIRM      → sees the directory, but only orgs covered by
//                    an active ClientAssignment are openable; the
//                    rest render a locked "Not assigned" state.
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Building2, Users, ShieldCheck, Mail } from "lucide-react";
import OpenWorkspaceButton from "@/components/workspace/OpenWorkspaceButton";

async function getDirectory(user: {
  id: string;
  organizationId: string;
  userRole: string | null;
  firmId: string | null;
}) {
  const organizations = await prisma.organization.findMany({
    where: {
      id: { not: user.organizationId },
      users: { some: { userRole: "CUSTOMER" } },
    },
    select: {
      id: true,
      name: true,
      plan: true,
      createdAt: true,
      onboardingCompleted: true,
      businessProfile: {
        select: {
          businessName: true,
          businessType: true,
          gstin: true,
          pan: true,
          contactEmail: true,
        },
      },
      _count: { select: { users: true } },
    },
    orderBy: { name: "asc" },
    take: 300,
  });

  let openable: Set<string>;
  if (user.userRole === "ADMIN") {
    openable = new Set(organizations.map((o) => o.id));
  } else {
    const assignments = await prisma.clientAssignment.findMany({
      where: {
        isActive: true,
        OR: [
          { caUserId: user.id },
          ...(user.userRole === "CA_FIRM_ADMIN" && user.firmId
            ? [{ firmId: user.firmId }]
            : []),
        ],
      },
      select: { organizationId: true },
    });
    openable = new Set(assignments.map((a) => a.organizationId));
  }

  return { organizations, openable };
}

export default async function AllCustomersPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (!user.userRole || user.userRole === "CUSTOMER") redirect("/dashboard");

  const { organizations, openable } = await getDirectory({
    id: user.id,
    organizationId: user.organizationId,
    userRole: user.userRole,
    firmId: user.firmId,
  });

  const assignedCount = organizations.filter((o) => openable.has(o.id)).length;

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 className="section-title">All Customers</h1>
          <p className="section-subtitle">
            {organizations.length} customer organization{organizations.length !== 1 ? "s" : ""} ·{" "}
            {user.userRole === "ADMIN"
              ? "full access (Super Admin)"
              : `${assignedCount} assigned to you`}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total Customers", value: organizations.length, color: "#6366f1" },
          { label: "Openable Workspaces", value: assignedCount, color: "#10b981" },
          { label: "Not Assigned", value: organizations.length - assignedCount, color: "#f59e0b" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Directory table */}
      {organizations.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <Users size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
              No customer organizations yet
            </p>
            <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 360, textAlign: "center" }}>
              Customer organizations appear here once they complete onboarding.
            </p>
          </div>
        </div>
      ) : (
        <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>GST / PAN</th>
                <th>Contact</th>
                <th>Users</th>
                <th>Since</th>
                <th>Workspace</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => {
                const bp = org.businessProfile;
                const canOpen = openable.has(org.id);
                return (
                  <tr key={org.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            flexShrink: 0,
                            background: canOpen
                              ? "linear-gradient(135deg, #6366f1, #0ea5e9)"
                              : "var(--bg-elevated)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Building2 size={14} color={canOpen ? "white" : "var(--text-muted)"} />
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                            {bp?.businessName ?? org.name}
                          </p>
                          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {bp?.businessType ?? org.plan}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>
                        {bp?.gstin && <p style={{ color: "var(--text-secondary)" }}>GST: {bp.gstin}</p>}
                        {bp?.pan && <p style={{ color: "var(--text-muted)" }}>PAN: {bp.pan}</p>}
                        {!bp?.gstin && !bp?.pan && <span style={{ color: "var(--text-muted)" }}>—</span>}
                      </div>
                    </td>
                    <td>
                      {bp?.contactEmail ? (
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                          <Mail size={10} /> {bp.contactEmail}
                        </p>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{org._count.users}</td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {format(org.createdAt, "dd MMM yyyy")}
                    </td>
                    <td>
                      <OpenWorkspaceButton organizationId={org.id} canOpen={canOpen} compact />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Access note */}
      <div
        style={{
          marginTop: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          borderRadius: 10,
          background: "rgba(14,165,233,0.06)",
          border: "1px solid rgba(14,165,233,0.18)",
        }}
      >
        <ShieldCheck size={14} color="#38bdf8" style={{ flexShrink: 0 }} />
        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Opening a workspace starts a fully audited impersonation session — every action you
          take on behalf of the client is recorded in the activity log.
        </p>
      </div>
    </div>
  );
}
