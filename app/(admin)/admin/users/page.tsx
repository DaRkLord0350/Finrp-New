import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Users } from "lucide-react";

async function getAllUsers() {
  return prisma.user.findMany({
    include: {
      organization: { select: { name: true } },
      firm: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

const roleColor: Record<string, string> = {
  ADMIN: "#6366f1",
  CA_FIRM_ADMIN: "#10b981",
  CA: "#0ea5e9",
  CUSTOMER: "#f59e0b",
};

export default async function AdminUsersPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "ADMIN") redirect("/dashboard");

  const users = await getAllUsers();

  const byRole = {
    ADMIN: users.filter((u) => u.userRole === "ADMIN").length,
    CA_FIRM_ADMIN: users.filter((u) => u.userRole === "CA_FIRM_ADMIN").length,
    CA: users.filter((u) => u.userRole === "CA").length,
    CUSTOMER: users.filter((u) => u.userRole === "CUSTOMER").length,
  };

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 className="section-title">Users</h1>
        <p className="section-subtitle">{users.length} total platform users</p>
      </div>

      {/* Role breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        {Object.entries(byRole).map(([role, count]) => (
          <div key={role} className="stat-card">
            <p style={{ fontSize: 28, fontWeight: 700, color: roleColor[role] }}>{count}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{role.replace("_", " ")}</p>
          </div>
        ))}
      </div>

      {users.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <Users size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No users yet</p>
          </div>
        </div>
      ) : (
        <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Organization</th>
                <th>Firm</th>
                <th>Status</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          background: `${roleColor[u.userRole] ?? "#94a3b8"}20`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 700,
                          color: roleColor[u.userRole] ?? "#94a3b8",
                          flexShrink: 0,
                        }}
                      >
                        {(u.name ?? u.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{u.name ?? "—"}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: `${roleColor[u.userRole]}18`,
                        color: roleColor[u.userRole],
                        borderColor: `${roleColor[u.userRole]}30`,
                      }}
                    >
                      {u.userRole.replace("_", " ")}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {u.organization.name}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {u.firm?.name ?? "—"}
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: u.isActive ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                        color: u.isActive ? "#10b981" : "#ef4444",
                        borderColor: u.isActive ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)",
                      }}
                    >
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {format(u.createdAt, "dd MMM yyyy")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
