import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ShieldCheck, Filter } from "lucide-react";

const TABS = [
  "All", "GST", "TDS", "Income Tax", "ROC", "PF", "ESI",
  "Professional Tax", "Labour", "Other",
];

async function getCACompliances(caUserId: string, tab?: string) {
  const orgIds = await prisma.cAClient.findMany({
    where: { caUserId, isActive: true },
    select: { organizationId: true },
  }).then((r) => r.map((c) => c.organizationId));

  if (orgIds.length === 0) return [];

  const categoryFilter =
    tab && tab !== "All"
      ? { category: { name: { contains: tab, mode: "insensitive" as const } } }
      : {};

  return prisma.complianceSubmission.findMany({
    where: {
      organizationId: { in: orgIds },
      deletedAt: null,
      ...categoryFilter,
    },
    include: {
      organization: { include: { businessProfile: true } },
      category: { select: { name: true, code: true } },
      type: { select: { name: true } },
      documents: { select: { id: true, reviewStatus: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 100,
  });
}

const WORKFLOW_STAGES = [
  { label: "Waiting For Documents", key: "DRAFT", color: "#94a3b8" },
  { label: "Documents Received", key: "SUBMITTED", color: "#3b82f6" },
  { label: "Under Verification", key: "UNDER_REVIEW", color: "#f59e0b" },
  { label: "Ready To File", key: "APPROVED", color: "#6366f1" },
  { label: "Filed / Completed", key: "COMPLETED", color: "#10b981" },
  { label: "Rejected", key: "REJECTED", color: "#ef4444" },
];

function statusColor(status: string) {
  return WORKFLOW_STAGES.find((s) => s.key === status)?.color ?? "#94a3b8";
}

export default async function CACompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab = "All" } = await searchParams;
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  const submissions = await getCACompliances(user.id, tab === "All" ? undefined : tab);

  // Group by workflow stage
  const grouped = WORKFLOW_STAGES.map((stage) => ({
    ...stage,
    items: submissions.filter((s) => s.status === stage.key),
  }));

  const counts = WORKFLOW_STAGES.reduce(
    (acc, s) => ({ ...acc, [s.key]: submissions.filter((sub) => sub.status === s.key).length }),
    {} as Record<string, number>
  );

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="section-title">Compliance Center</h1>
        <p className="section-subtitle">
          {submissions.length} compliance record{submissions.length !== 1 ? "s" : ""} across all clients
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          overflowX: "auto",
          marginBottom: 24,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 0,
        }}
      >
        {TABS.map((t) => (
          <a
            key={t}
            href={`/ca/compliance?tab=${encodeURIComponent(t)}`}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? "var(--brand-400)" : "var(--text-muted)",
              borderBottom: tab === t ? "2px solid var(--brand-400)" : "2px solid transparent",
              textDecoration: "none",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
            }}
          >
            {t}
          </a>
        ))}
      </div>

      {/* Workflow summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 28,
        }}
      >
        {WORKFLOW_STAGES.map((s) => (
          <div
            key={s.key}
            className="stat-card"
            style={{ padding: "14px 16px", borderLeft: `3px solid ${s.color}` }}
          >
            <p style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{counts[s.key] ?? 0}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.3 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {submissions.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <ShieldCheck size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No compliance records</p>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              {tab !== "All" ? `No ${tab} compliances found` : "No client compliances found"}
            </p>
          </div>
        </div>
      ) : (
        <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              All Compliances
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Filter size={14} color="var(--text-muted)" />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Filter</span>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Compliance</th>
                <th>Client</th>
                <th>Category</th>
                <th>Period</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Documents</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => {
                const isOverdue =
                  s.dueDate && s.dueDate < new Date() && !["APPROVED", "COMPLETED"].includes(s.status);
                const pendingDocs = s.documents.filter((d) => d.reviewStatus === "PENDING").length;
                return (
                  <tr key={s.id}>
                    <td>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{s.title}</p>
                      {s.type && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.type.name}</p>}
                    </td>
                    <td>
                      <a href={`/ca/client/${s.organizationId}`} style={{ textDecoration: "none" }}>
                        <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
                          {s.organization.businessProfile?.businessName ?? s.organization.name}
                        </span>
                      </a>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{s.category.name}</td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {s.effectiveDate ? format(s.effectiveDate, "MMM yyyy") : "—"}
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: isOverdue ? "#ef4444" : "var(--text-secondary)", fontWeight: isOverdue ? 600 : 400 }}>
                        {s.dueDate ? format(s.dueDate, "dd MMM yyyy") : "—"}
                        {isOverdue && " ⚠"}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: `${statusColor(s.status)}18`,
                          color: statusColor(s.status),
                          borderColor: `${statusColor(s.status)}30`,
                        }}
                      >
                        {s.status.replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: "var(--text-secondary)" }}>{s.documents.length}</span>
                        {pendingDocs > 0 && (
                          <span style={{ color: "#f59e0b", fontWeight: 600, marginLeft: 6 }}>
                            ({pendingDocs} pending)
                          </span>
                        )}
                      </div>
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
