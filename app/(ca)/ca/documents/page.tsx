import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { FolderOpen, CheckCircle2, XCircle, Clock } from "lucide-react";
import DocumentReviewActions from "./DocumentReviewActions";

async function getAssignedDocuments(caUserId: string) {
  return prisma.complianceDocument.findMany({
    where: {
      submission: {
        organization: {
          caClients: { some: { caUserId } },
        },
      },
    },
    select: {
      id: true,
      fileName: true,
      fileExtension: true,
      fileSize: true,
      reviewStatus: true,
      reviewComment: true,
      documentType: true,
      description: true,
      uploadedAt: true,
      reviewedAt: true,
      submission: {
        select: {
          title: true,
          organization: {
            select: {
              name: true,
              businessProfile: { select: { businessName: true } },
            },
          },
        },
      },
    },
    orderBy: { uploadedAt: "desc" },
    take: 50,
  });
}

const reviewStatusColor: Record<string, string> = {
  PENDING: "#f59e0b",
  APPROVED: "#10b981",
  REJECTED: "#ef4444",
  CHANGES_REQUESTED: "#f97316",
};

export default async function CADocumentsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  const docs = await getAssignedDocuments(user.id);
  const pending = docs.filter((d) => d.reviewStatus === "PENDING").length;
  const approved = docs.filter((d) => d.reviewStatus === "APPROVED").length;
  const rejected = docs.filter((d) => d.reviewStatus === "REJECTED").length;

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 className="section-title">Document Review</h1>
        <p className="section-subtitle">Review documents from your assigned clients</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total", value: docs.length, color: "#6366f1" },
          { label: "Pending Review", value: pending, color: "#f59e0b" },
          { label: "Approved", value: approved, color: "#10b981" },
          { label: "Rejected", value: rejected, color: "#ef4444" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {docs.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <FolderOpen size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No documents yet</p>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              Documents uploaded by your clients will appear here for review.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="section-card"
              style={{ padding: "16px 20px" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: `${reviewStatusColor[doc.reviewStatus]}18`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {doc.reviewStatus === "APPROVED" ? (
                      <CheckCircle2 size={16} color="#10b981" />
                    ) : doc.reviewStatus === "REJECTED" ? (
                      <XCircle size={16} color="#ef4444" />
                    ) : (
                      <Clock size={16} color="#f59e0b" />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                      {doc.fileName}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
                      {doc.submission?.organization.businessProfile?.businessName ??
                        doc.submission?.organization.name ??
                        "—"}{" "}
                      {doc.submission?.title ? `· ${doc.submission.title}` : ""}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {(doc.fileSize / 1024).toFixed(0)} KB · {doc.fileExtension.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        Uploaded {format(doc.uploadedAt, "dd MMM yyyy")}
                      </span>
                      {doc.reviewedAt && (
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          Reviewed {format(doc.reviewedAt, "dd MMM yyyy")}
                        </span>
                      )}
                    </div>
                    {doc.reviewComment && (
                      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>
                        "{doc.reviewComment}"
                      </p>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span
                    className="badge"
                    style={{
                      background: `${reviewStatusColor[doc.reviewStatus]}18`,
                      color: reviewStatusColor[doc.reviewStatus],
                      borderColor: `${reviewStatusColor[doc.reviewStatus]}30`,
                    }}
                  >
                    {doc.reviewStatus.replace("_", " ")}
                  </span>
                  {doc.reviewStatus === "PENDING" && (
                    <DocumentReviewActions documentId={doc.id} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
