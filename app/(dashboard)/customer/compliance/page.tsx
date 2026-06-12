import { getCurrentUser } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/auth/organization";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ShieldCheck, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

async function getComplianceTimeline(orgId: string) {
  return prisma.complianceSubmission.findMany({
    where: { organizationId: orgId, deletedAt: null },
    include: {
      category: { select: { name: true, color: true } },
      statusHistory: {
        orderBy: { changedAt: "desc" },
        take: 1,
        select: { toStatus: true, changedAt: true, reason: true },
      },
    },
    orderBy: { dueDate: "asc" },
  });
}

const statusColor: Record<string, string> = {
  DRAFT: "#94a3b8",
  SUBMITTED: "#3b82f6",
  UNDER_REVIEW: "#f59e0b",
  APPROVED: "#10b981",
  COMPLETED: "#10b981",
  REJECTED: "#ef4444",
  EXPIRED: "#ef4444",
  PENDING_RENEWAL: "#f97316",
};

export default async function CustomerCompliancePage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");

  // Workspace-aware: serves the impersonated client org when a CA is viewing
  const organizationId = await getOrganizationId();
  const submissions = await getComplianceTimeline(organizationId);

  const completed = submissions.filter((s) => ["APPROVED", "COMPLETED"].includes(s.status)).length;
  const overdue = submissions.filter(
    (s) => s.dueDate && s.dueDate < new Date() && !["APPROVED", "COMPLETED"].includes(s.status)
  ).length;
  const upcoming = submissions.filter(
    (s) => s.dueDate && s.dueDate >= new Date() && !["APPROVED", "COMPLETED"].includes(s.status)
  ).length;

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 className="section-title">Compliance Timeline</h1>
        <p className="section-subtitle">Your complete compliance history and upcoming deadlines</p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total", value: submissions.length, color: "#6366f1" },
          { label: "Completed", value: completed, color: "#10b981" },
          { label: "Overdue", value: overdue, color: "#ef4444" },
          { label: "Upcoming", value: upcoming, color: "#f59e0b" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {submissions.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <ShieldCheck size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
              No compliance items yet
            </p>
          </div>
        </div>
      ) : (
        <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Compliance</th>
                <th>Category</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Last Update</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub) => {
                const isOverdue = sub.dueDate && sub.dueDate < new Date() && !["APPROVED", "COMPLETED"].includes(sub.status);
                return (
                  <tr key={sub.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: statusColor[sub.status] ?? "#94a3b8",
                            flexShrink: 0,
                          }}
                        />
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{sub.title}</p>
                          {sub.description && (
                            <p style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240, whiteSpace: "nowrap" }}>
                              {sub.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: `${sub.category.color}18`,
                          color: sub.category.color,
                          borderColor: `${sub.category.color}30`,
                        }}
                      >
                        {sub.category.name}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 12,
                          color: isOverdue ? "#ef4444" : "var(--text-muted)",
                          fontWeight: isOverdue ? 600 : 400,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {isOverdue && <AlertTriangle size={12} />}
                        {sub.dueDate ? format(sub.dueDate, "dd MMM yyyy") : "—"}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: `${statusColor[sub.status]}18`,
                          color: statusColor[sub.status],
                          borderColor: `${statusColor[sub.status]}30`,
                        }}
                      >
                        {sub.status.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {sub.statusHistory[0]
                        ? format(sub.statusHistory[0].changedAt, "dd MMM yyyy")
                        : format(sub.updatedAt, "dd MMM yyyy")}
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
