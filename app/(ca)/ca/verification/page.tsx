import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { CheckSquare, Eye, Download, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import VerificationActions from "./VerificationActions";

async function getPendingDocuments(caUserId: string, filter: string = "PENDING") {
  const orgIds = await prisma.cAClient.findMany({
    where: { caUserId, isActive: true },
    select: { organizationId: true },
  }).then((r) => r.map((c) => c.organizationId));

  if (orgIds.length === 0) return [];

  const where =
    filter === "ALL"
      ? { organizationId: { in: orgIds } }
      : { organizationId: { in: orgIds }, reviewStatus: filter as "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" };

  return prisma.complianceDocument.findMany({
    where: {
      ...where,
      submission: { deletedAt: null },
    },
    include: {
      submission: {
        include: {
          organization: { include: { businessProfile: true } },
          category: { select: { name: true } },
        },
      },
    },
    orderBy: { uploadedAt: "desc" },
    take: 50,
  });
}

const FILTER_TABS = [
  { key: "PENDING", label: "Pending Review", color: "#f59e0b" },
  { key: "APPROVED", label: "Approved", color: "#10b981" },
  { key: "REJECTED", label: "Rejected", color: "#ef4444" },
  { key: "CHANGES_REQUESTED", label: "Changes Requested", color: "#f97316" },
  { key: "ALL", label: "All Documents", color: "var(--text-muted)" },
];

function reviewStatusColor(s: string) {
  const m: Record<string, string> = {
    PENDING: "#f59e0b",
    APPROVED: "#10b981",
    REJECTED: "#ef4444",
    CHANGES_REQUESTED: "#f97316",
  };
  return m[s] ?? "#94a3b8";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function CAVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "PENDING" } = await searchParams;
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  const documents = await getPendingDocuments(user.id, filter);

  // Count per status
  const counts = await (async () => {
    const orgIds = await prisma.cAClient.findMany({
      where: { caUserId: user.id, isActive: true },
      select: { organizationId: true },
    }).then((r) => r.map((c) => c.organizationId));

    const result = await prisma.complianceDocument.groupBy({
      by: ["reviewStatus"],
      where: { organizationId: { in: orgIds }, submission: { deletedAt: null } },
      _count: { id: true },
    });

    return result.reduce((acc, r) => ({ ...acc, [r.reviewStatus]: r._count.id }), {} as Record<string, number>);
  })();

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="section-title">Verification Center</h1>
        <p className="section-subtitle">Review and verify documents submitted by clients</p>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 4, overflowX: "auto", marginBottom: 24, borderBottom: "1px solid var(--border)" }}>
        {FILTER_TABS.map((t) => (
          <a
            key={t.key}
            href={`/ca/verification?filter=${t.key}`}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: filter === t.key ? 600 : 400,
              color: filter === t.key ? t.color : "var(--text-muted)",
              borderBottom: filter === t.key ? `2px solid ${t.color}` : "2px solid transparent",
              textDecoration: "none",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {t.label}
            {counts[t.key] !== undefined && (
              <span
                style={{
                  padding: "0 6px",
                  borderRadius: 99,
                  background: filter === t.key ? `${t.color}20` : "var(--bg-elevated)",
                  color: filter === t.key ? t.color : "var(--text-muted)",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {counts[t.key]}
              </span>
            )}
          </a>
        ))}
      </div>

      {/* Documents */}
      {documents.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <CheckSquare size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
              No documents to review
            </p>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              {filter === "PENDING"
                ? "All documents have been reviewed"
                : "No documents in this category"}
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="section-card"
              style={{
                padding: "16px 20px",
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
              }}
            >
              {/* File icon */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: `${reviewStatusColor(doc.reviewStatus)}15`,
                  border: `1px solid ${reviewStatusColor(doc.reviewStatus)}30`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: reviewStatusColor(doc.reviewStatus) }}>
                  {doc.fileExtension.toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {doc.fileName}
                  </p>
                  <span
                    className="badge"
                    style={{
                      background: `${reviewStatusColor(doc.reviewStatus)}18`,
                      color: reviewStatusColor(doc.reviewStatus),
                      borderColor: `${reviewStatusColor(doc.reviewStatus)}30`,
                      flexShrink: 0,
                    }}
                  >
                    {doc.reviewStatus.replace("_", " ")}
                  </span>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {doc.submission?.organization.businessProfile?.businessName ?? doc.submission?.organization.name ?? "Unknown Client"}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {doc.submission?.category.name}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {formatBytes(doc.fileSize)}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    v{doc.version}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Uploaded {formatDistanceToNow(doc.uploadedAt, { addSuffix: true })}
                  </span>
                </div>

                {doc.reviewComment && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: "8px 10px",
                      borderRadius: 6,
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      fontSize: 12,
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>Review note: </span>
                    {doc.reviewComment}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "flex-start" }}>
                {doc.reviewStatus === "PENDING" && (
                  <VerificationActions documentId={doc.id} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
