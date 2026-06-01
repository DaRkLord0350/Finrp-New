import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Building2, Users, Mail, Phone } from "lucide-react";

async function getFirms() {
  const firms = await prisma.firm.findMany({
    include: {
      _count: {
        select: { users: true, customers: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return firms;
}

export default async function AdminFirmsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "ADMIN") redirect("/dashboard");

  const firms = await getFirms();

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 className="section-title">CA Firms</h1>
          <p className="section-subtitle">{firms.length} registered firm{firms.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Stats Row */}
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}
      >
        {[
          { label: "Total Firms", value: firms.length, color: "#6366f1" },
          { label: "Active", value: firms.filter((f) => f.isActive).length, color: "#10b981" },
          { label: "Total Staff", value: firms.reduce((a, f) => a + f._count.users, 0), color: "#0ea5e9" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {firms.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <Building2 size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No firms yet</p>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              CA firms will appear here once they register.
            </p>
          </div>
        </div>
      ) : (
        <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Firm</th>
                <th>Contact</th>
                <th>Staff</th>
                <th>Customers</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {firms.map((firm) => (
                <tr key={firm.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: "rgba(99,102,241,0.12)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Building2 size={15} color="#6366f1" />
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{firm.name}</p>
                        {firm.address && (
                          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{firm.address}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12 }}>
                      {firm.email && (
                        <p style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-secondary)" }}>
                          <Mail size={10} /> {firm.email}
                        </p>
                      )}
                      {firm.phone && (
                        <p style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-muted)" }}>
                          <Phone size={10} /> {firm.phone}
                        </p>
                      )}
                      {!firm.email && !firm.phone && <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Users size={12} color="var(--text-muted)" />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {firm._count.users}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      {firm._count.customers}
                    </span>
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: firm.isActive ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                        color: firm.isActive ? "#10b981" : "#ef4444",
                        borderColor: firm.isActive ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)",
                      }}
                    >
                      {firm.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {format(firm.createdAt, "dd MMM yyyy")}
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
