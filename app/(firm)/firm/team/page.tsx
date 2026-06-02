import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { UserCog, Users } from "lucide-react";

async function getTeamMembers(orgId: string) {
  return prisma.user.findMany({
    where: {
      organizationId: orgId,
      userRole: { in: ["CA", "CA_FIRM_ADMIN"] },
    },
    include: {
      _count: {
        select: {
          customerAssignments: { where: { isActive: true } },
          firmTasksAsCa: { where: { status: { not: "COMPLETED" } } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

const roleColor: Record<string, string> = {
  CA_FIRM_ADMIN: "#10b981",
  CA: "#0ea5e9",
};

export default async function FirmTeamPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "CA_FIRM_ADMIN") redirect("/dashboard");

  const team = await getTeamMembers(user.organizationId);

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 className="section-title">Team</h1>
          <p className="section-subtitle">{team.length} team member{team.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total Team", value: team.length, color: "#6366f1" },
          { label: "CA Members", value: team.filter((t) => t.userRole === "CA").length, color: "#0ea5e9" },
          { label: "Active Assignments", value: team.reduce((a, t) => a + t._count.customerAssignments, 0), color: "#10b981" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {team.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <UserCog size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No team members yet</p>
            <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 300, textAlign: "center" }}>
              Invite CA users to join your firm. They will appear here once they register.
            </p>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {team.map((member) => (
            <div key={member.id} className="section-card">
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: `${roleColor[member.userRole ?? "CUSTOMER"] ?? "#94a3b8"}20`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    fontWeight: 700,
                    color: roleColor[member.userRole ?? "CUSTOMER"] ?? "#94a3b8",
                    flexShrink: 0,
                  }}
                >
                  {(member.name ?? member.email).charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {member.name ?? "—"}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {member.email}
                  </p>
                </div>
                <span
                  className="badge"
                  style={{
                    background: `${roleColor[member.userRole ?? "CUSTOMER"] ?? "#94a3b8"}18`,
                    color: roleColor[member.userRole ?? "CUSTOMER"] ?? "#94a3b8",
                    borderColor: `${roleColor[member.userRole ?? "CUSTOMER"] ?? "#94a3b8"}30`,
                    flexShrink: 0,
                  }}
                >
                  {(member.userRole ?? "—").replace("_", " ")}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div
                  style={{
                    padding: "10px 12px",
                    background: "var(--bg-elevated)",
                    borderRadius: 8,
                    textAlign: "center",
                  }}
                >
                  <p style={{ fontSize: 20, fontWeight: 700, color: "#0ea5e9" }}>
                    {member._count.customerAssignments}
                  </p>
                  <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Customers</p>
                </div>
                <div
                  style={{
                    padding: "10px 12px",
                    background: "var(--bg-elevated)",
                    borderRadius: 8,
                    textAlign: "center",
                  }}
                >
                  <p style={{ fontSize: 20, fontWeight: 700, color: "#f59e0b" }}>
                    {member._count.firmTasksAsCa}
                  </p>
                  <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Open Tasks</p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: member.isActive ? "#10b981" : "#ef4444",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {member.isActive ? "Active" : "Inactive"} · Joined {format(member.createdAt, "MMM yyyy")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
