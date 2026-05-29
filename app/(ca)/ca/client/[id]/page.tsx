import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  Building2, Mail, Phone, MapPin, ArrowLeft,
  ShieldCheck, FileText, Clock, CheckCircle2,
  XCircle, AlertTriangle, CalendarDays,
} from "lucide-react";

async function getClientWorkspace(caUserId: string, organizationId: string) {
  const caClient = await prisma.cAClient.findUnique({
    where: { caUserId_organizationId: { caUserId, organizationId } },
  });
  if (!caClient) return null;

  const [organization, submissions, documents] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      include: { businessProfile: true },
    }),
    prisma.complianceSubmission.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        category: { select: { name: true, code: true } },
        type: { select: { name: true } },
        documents: { select: { id: true, reviewStatus: true, fileName: true, uploadedAt: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.complianceDocument.findMany({
      where: {
        organizationId,
        submission: { deletedAt: null },
      },
      include: {
        submission: { select: { title: true, categoryId: true } },
      },
      orderBy: { uploadedAt: "desc" },
      take: 20,
    }),
  ]);

  if (!organization) return null;
  return { organization, submissions, documents };
}

function statusColor(status: string) {
  const m: Record<string, string> = {
    DRAFT: "#94a3b8",
    SUBMITTED: "#3b82f6",
    UNDER_REVIEW: "#f59e0b",
    APPROVED: "#10b981",
    COMPLETED: "#10b981",
    REJECTED: "#ef4444",
    EXPIRED: "#ef4444",
    PENDING_RENEWAL: "#f97316",
  };
  return m[status] ?? "#94a3b8";
}

function reviewStatusColor(s: string) {
  const m: Record<string, string> = { PENDING: "#f59e0b", APPROVED: "#10b981", REJECTED: "#ef4444", CHANGES_REQUESTED: "#f97316" };
  return m[s] ?? "#94a3b8";
}

export default async function ClientWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: organizationId } = await params;
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  const data = await getClientWorkspace(user.id, organizationId);
  if (!data) notFound();

  const { organization, submissions, documents } = data;
  const bp = organization.businessProfile;

  const overdue = submissions.filter(
    (s) => s.dueDate && s.dueDate < new Date() && !["APPROVED", "COMPLETED"].includes(s.status)
  ).length;
  const completed = submissions.filter((s) => ["APPROVED", "COMPLETED"].includes(s.status)).length;
  const pending = submissions.filter((s) => !["APPROVED", "COMPLETED", "REJECTED"].includes(s.status)).length;

  return (
    <div className="page-container animate-fade-in">
      {/* Back */}
      <Link
        href="/ca/clients"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 13, textDecoration: "none", marginBottom: 20 }}
      >
        <ArrowLeft size={14} />
        Back to Clients
      </Link>

      {/* Client Header */}
      <div
        className="section-card"
        style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(14,165,233,0.2))",
              border: "1px solid rgba(99,102,241,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Building2 size={24} color="var(--brand-400)" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
              {bp?.businessName ?? organization.name}
            </h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 6 }}>
              {bp?.businessType && (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{bp.businessType}</span>
              )}
              {bp?.gstin && (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>GST: {bp.gstin}</span>
              )}
              {bp?.pan && (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>PAN: {bp.pan}</span>
              )}
              {bp?.cin && (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>CIN: {bp.cin}</span>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 4 }}>
              {bp?.contactEmail && (
                <span style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                  <Mail size={11} /> {bp.contactEmail}
                </span>
              )}
              {bp?.phone && (
                <span style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                  <Phone size={11} /> {bp.phone}
                </span>
              )}
              {bp?.city && (
                <span style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                  <MapPin size={11} /> {bp.city}{bp.state ? `, ${bp.state}` : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: "flex", gap: 16 }}>
          {[
            { label: "Total", value: submissions.length, color: "var(--text-primary)" },
            { label: "Active", value: pending, color: "#3b82f6" },
            { label: "Completed", value: completed, color: "#10b981" },
            { label: "Overdue", value: overdue, color: "#ef4444" },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <p style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main content grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>

        {/* Compliances */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldCheck size={16} color="#0ea5e9" />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                Compliances ({submissions.length})
              </h2>
            </div>
            {submissions.length === 0 ? (
              <div className="empty-state">
                <ShieldCheck size={36} color="var(--text-muted)" />
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No compliances found</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Documents</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => {
                    const pendingDocs = s.documents.filter((d) => d.reviewStatus === "PENDING").length;
                    const isOverdue = s.dueDate && s.dueDate < new Date() && !["APPROVED", "COMPLETED"].includes(s.status);
                    return (
                      <tr key={s.id}>
                        <td>
                          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{s.title}</p>
                          {s.type && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.type.name}</p>}
                        </td>
                        <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>{s.category.name}</td>
                        <td>
                          {s.dueDate ? (
                            <span style={{ fontSize: 12, color: isOverdue ? "#ef4444" : "var(--text-secondary)", fontWeight: isOverdue ? 600 : 400 }}>
                              {format(s.dueDate, "dd MMM yyyy")}
                              {isOverdue && " ⚠"}
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                          )}
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
                            <span style={{ color: "var(--text-secondary)" }}>{s.documents.length} docs</span>
                            {pendingDocs > 0 && (
                              <span style={{ color: "#f59e0b", fontWeight: 600, marginLeft: 6 }}>
                                {pendingDocs} pending
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Documents */}
        <div>
          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <FileText size={16} color="#f59e0b" />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                Recent Documents
              </h2>
            </div>
            {documents.length === 0 ? (
              <div className="empty-state" style={{ padding: "24px 16px" }}>
                <FileText size={28} color="var(--text-muted)" />
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No documents uploaded</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                        {doc.fileName}
                      </p>
                      <span
                        className="badge"
                        style={{
                          background: `${reviewStatusColor(doc.reviewStatus)}18`,
                          color: reviewStatusColor(doc.reviewStatus),
                          borderColor: `${reviewStatusColor(doc.reviewStatus)}30`,
                          marginLeft: 8,
                          flexShrink: 0,
                        }}
                      >
                        {doc.reviewStatus.replace("_", " ")}
                      </span>
                    </div>
                    <p style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {formatDistanceToNow(doc.uploadedAt, { addSuffix: true })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
