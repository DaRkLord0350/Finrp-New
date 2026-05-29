import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Users, Search, Building2, Phone, Mail, TrendingUp } from "lucide-react";

async function getCAClients(caUserId: string) {
  return prisma.cAClient.findMany({
    where: { caUserId, isActive: true },
    include: {
      organization: {
        include: {
          businessProfile: true,
          complianceSubmissions: {
            where: { deletedAt: null },
            select: { status: true, dueDate: true, updatedAt: true },
          },
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  });
}

function getHealthScore(submissions: { status: string; dueDate: Date | null }[]) {
  if (submissions.length === 0) return 100;
  const overdue = submissions.filter(
    (s) => s.dueDate && s.dueDate < new Date() && !["APPROVED", "COMPLETED"].includes(s.status)
  ).length;
  const ratio = overdue / submissions.length;
  if (ratio === 0) return 100;
  if (ratio <= 0.1) return 80;
  if (ratio <= 0.3) return 60;
  if (ratio <= 0.5) return 40;
  return 20;
}

function getStatusLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 90) return { label: "Healthy", color: "#10b981", bg: "rgba(16,185,129,0.1)" };
  if (score >= 70) return { label: "Minor Issues", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" };
  if (score >= 50) return { label: "Attention Required", color: "#f97316", bg: "rgba(249,115,22,0.1)" };
  if (score >= 30) return { label: "Missing Docs", color: "#ef4444", bg: "rgba(239,68,68,0.1)" };
  return { label: "Overdue", color: "#dc2626", bg: "rgba(220,38,38,0.1)" };
}

export default async function CAClientsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  const clients = await getCAClients(user.id);

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 className="section-title">Clients</h1>
          <p className="section-subtitle">{clients.length} managed client{clients.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 28,
        }}
      >
        {[
          { label: "Total Clients", value: clients.length, color: "#6366f1" },
          {
            label: "Healthy",
            value: clients.filter((c) => getHealthScore(c.organization.complianceSubmissions) >= 90).length,
            color: "#10b981",
          },
          {
            label: "Attention Required",
            value: clients.filter((c) => {
              const s = getHealthScore(c.organization.complianceSubmissions);
              return s >= 30 && s < 90;
            }).length,
            color: "#f97316",
          },
          {
            label: "Overdue",
            value: clients.filter((c) => getHealthScore(c.organization.complianceSubmissions) < 30).length,
            color: "#ef4444",
          },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Clients table */}
      {clients.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <Users size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No clients yet</p>
            <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 320, textAlign: "center" }}>
              Ask your admin to assign customer organizations to your CA account.
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
                <th>Compliances</th>
                <th>Health Score</th>
                <th>Status</th>
                <th>Assigned</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const bp = c.organization.businessProfile;
                const subs = c.organization.complianceSubmissions;
                const score = getHealthScore(subs);
                const status = getStatusLabel(score);
                const overdue = subs.filter(
                  (s) => s.dueDate && s.dueDate < new Date() && !["APPROVED", "COMPLETED"].includes(s.status)
                ).length;

                return (
                  <tr key={c.id} style={{ cursor: "pointer" }}>
                    <td>
                      <a href={`/ca/client/${c.organizationId}`} style={{ textDecoration: "none" }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                            {bp?.businessName ?? c.organization.name}
                          </p>
                          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {bp?.businessType ?? "—"}
                          </p>
                        </div>
                      </a>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>
                        {bp?.gstin && (
                          <p style={{ color: "var(--text-secondary)" }}>GST: {bp.gstin}</p>
                        )}
                        {bp?.pan && (
                          <p style={{ color: "var(--text-muted)" }}>PAN: {bp.pan}</p>
                        )}
                        {!bp?.gstin && !bp?.pan && (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>
                        {bp?.contactEmail && (
                          <p style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                            <Mail size={10} /> {bp.contactEmail}
                          </p>
                        )}
                        {bp?.phone && (
                          <p style={{ color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                            <Phone size={10} /> {bp.phone}
                          </p>
                        )}
                        {!bp?.contactEmail && !bp?.phone && (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>
                        <p style={{ color: "var(--text-primary)", fontWeight: 500 }}>{subs.length} total</p>
                        {overdue > 0 && (
                          <p style={{ color: "#ef4444", fontWeight: 600 }}>{overdue} overdue</p>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                          style={{
                            flex: 1,
                            height: 6,
                            borderRadius: 99,
                            background: "var(--bg-overlay)",
                            overflow: "hidden",
                            maxWidth: 80,
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${score}%`,
                              background: status.color,
                              borderRadius: 99,
                              transition: "width 0.4s ease",
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: status.color }}>
                          {score}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: status.bg,
                          color: status.color,
                          borderColor: `${status.color}30`,
                        }}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {format(c.assignedAt, "dd MMM yyyy")}
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
