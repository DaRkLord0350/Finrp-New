import { getCurrentUser } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/auth/organization";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Upload, CheckCircle2, XCircle, Clock, FolderOpen } from "lucide-react";
import { resolvePortalClient } from "@/lib/client-portal/context";
import { listDocumentRequests } from "@/lib/client-portal/queries";
import {
  CustomerDocumentRequests,
  type CustomerDocRequestRow,
} from "@/components/portal/CustomerDocumentRequests";

async function getCustomerDocuments(orgId: string) {
  return prisma.complianceDocument.findMany({
    where: { organizationId: orgId },
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
          category: { select: { name: true } },
        },
      },
    },
    orderBy: { uploadedAt: "desc" },
  });
}

const reviewStatusColor: Record<string, string> = {
  PENDING: "#f59e0b",
  APPROVED: "#10b981",
  REJECTED: "#ef4444",
  CHANGES_REQUESTED: "#f97316",
};

export default async function CustomerDocumentsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");

  // Workspace-aware: serves the impersonated client org when a CA is viewing
  const organizationId = await getOrganizationId();
  const docs = await getCustomerDocuments(organizationId);

  // Portal document requests from the firm (bridged to the firm org).
  const ctx = await resolvePortalClient({
    id: user.id,
    email: user.email,
    organizationId: user.organizationId,
    firmId: user.firmId,
    userRole: user.userRole,
  });
  const requestRows = ctx
    ? await listDocumentRequests(ctx.organizationId, { customerId: ctx.customerId })
    : [];
  const portalRequests: CustomerDocRequestRow[] = requestRows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    status: r.status,
    dueDate: r.dueDate?.toISOString() ?? null,
    uploads: r.uploads.map((u) => ({
      id: u.id,
      fileName: u.fileName,
      status: u.status,
      reviewNotes: u.reviewNotes,
    })),
  }));

  const pending = docs.filter((d) => d.reviewStatus === "PENDING").length;
  const approved = docs.filter((d) => d.reviewStatus === "APPROVED").length;
  const rejected = docs.filter((d) => d.reviewStatus === "REJECTED").length;

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 className="section-title">My Documents</h1>
          <p className="section-subtitle">Compliance documents you&apos;ve uploaded</p>
        </div>
        <Link
          href="/compliance/submissions"
          className="btn-brand"
          style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}
        >
          <Upload size={15} />
          Upload Document
        </Link>
      </div>

      {/* Portal document requests from your CA — upload here */}
      <CustomerDocumentRequests requests={portalRequests} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total Uploaded", value: docs.length, color: "#6366f1" },
          { label: "Pending Review", value: pending, color: "#f59e0b" },
          { label: "Approved", value: approved, color: "#10b981" },
          { label: "Needs Revision", value: rejected, color: "#ef4444" },
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
            <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 320, textAlign: "center" }}>
              Upload compliance documents through your submissions portal for your CA to review.
            </p>
            <Link
              href="/compliance/submissions"
              className="btn-brand"
              style={{ textDecoration: "none" }}
            >
              Go to Compliance
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="section-card"
              style={{ padding: "14px 18px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: `${reviewStatusColor[doc.reviewStatus]}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {doc.reviewStatus === "APPROVED" ? (
                    <CheckCircle2 size={18} color="#10b981" />
                  ) : doc.reviewStatus === "REJECTED" ? (
                    <XCircle size={18} color="#ef4444" />
                  ) : (
                    <Clock size={18} color="#f59e0b" />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                    {doc.fileName}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    {doc.submission?.title && (
                      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        {doc.submission.title}
                        {doc.submission.category ? ` · ${doc.submission.category.name}` : ""}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {(doc.fileSize / 1024).toFixed(0)} KB · {doc.fileExtension.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {format(doc.uploadedAt, "dd MMM yyyy")}
                    </span>
                  </div>
                  {doc.reviewComment && doc.reviewStatus !== "APPROVED" && (
                    <p style={{ fontSize: 12, color: doc.reviewStatus === "REJECTED" ? "#ef4444" : "#f59e0b", marginTop: 4 }}>
                      CA Note: {doc.reviewComment}
                    </p>
                  )}
                </div>
                <span
                  className="badge"
                  style={{
                    background: `${reviewStatusColor[doc.reviewStatus]}18`,
                    color: reviewStatusColor[doc.reviewStatus],
                    borderColor: `${reviewStatusColor[doc.reviewStatus]}30`,
                    flexShrink: 0,
                  }}
                >
                  {doc.reviewStatus.replace("_", " ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
