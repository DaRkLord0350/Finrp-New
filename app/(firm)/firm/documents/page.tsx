import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { FolderOpen, FileCheck, CheckCircle2, XCircle, Clock } from "lucide-react";

async function getFirmDocuments(orgId: string) {
  return prisma.complianceDocument.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      fileName: true,
      fileExtension: true,
      mimeType: true,
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
          organization: { select: { name: true, businessProfile: { select: { businessName: true } } } },
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

export default async function FirmDocumentsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "CA_FIRM_ADMIN") redirect("/dashboard");

  const docs = await getFirmDocuments(user.organizationId);

  const pending = docs.filter((d) => d.reviewStatus === "PENDING").length;
  const approved = docs.filter((d) => d.reviewStatus === "APPROVED").length;
  const rejected = docs.filter((d) => d.reviewStatus === "REJECTED").length;

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 className="section-title">Documents</h1>
        <p className="section-subtitle">Compliance documents across all clients</p>
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
              Documents uploaded by clients will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Client</th>
                <th>Type</th>
                <th>Size</th>
                <th>Status</th>
                <th>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: `${reviewStatusColor[doc.reviewStatus]}18`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {doc.reviewStatus === "APPROVED" ? (
                          <CheckCircle2 size={14} color="#10b981" />
                        ) : doc.reviewStatus === "REJECTED" ? (
                          <XCircle size={14} color="#ef4444" />
                        ) : (
                          <Clock size={14} color="#f59e0b" />
                        )}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                          {doc.fileName}
                        </p>
                        {doc.description && (
                          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{doc.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {doc.submission?.organization.businessProfile?.businessName ??
                      doc.submission?.organization.name ??
                      "—"}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {doc.documentType ?? doc.fileExtension.toUpperCase()}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {(doc.fileSize / 1024).toFixed(0)} KB
                  </td>
                  <td>
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
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {format(doc.uploadedAt, "dd MMM yyyy")}
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
