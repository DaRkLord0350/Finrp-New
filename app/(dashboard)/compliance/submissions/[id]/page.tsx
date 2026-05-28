"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronRight,
  ShieldCheck,
  FileText,
  Clock,
  Calendar,
  Upload,
  Download,
  Trash2,
  Edit,
  AlertTriangle,
  Tag,
  RefreshCw,
} from "lucide-react";
import StatusBadge from "@/components/compliance/StatusBadge";
import ApprovalPanel from "@/components/compliance/ApprovalPanel";
import AuditTimeline from "@/components/compliance/AuditTimeline";
import UploadDocumentModal from "@/components/compliance/UploadDocumentModal";
import type {
  ComplianceSubmissionRecord,
  ComplianceStatus,
  ComplianceApprovalAction,
} from "@/types/compliance";
import { format } from "date-fns";

interface Props {
  params: Promise<{ id: string }>;
}

export default function SubmissionDetailPage({ params }: Props) {
  const { id } = use(params);
  const [submission, setSubmission] = useState<ComplianceSubmissionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "documents" | "approvals" | "history">("overview");
  const [showUpload, setShowUpload] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);

  const fetchSubmission = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/compliance/submissions/${id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Submission not found");
        throw new Error("Failed to fetch submission");
      }
      setSubmission(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmission();
  }, [id]);

  const handleApprove = async (
    action: ComplianceApprovalAction,
    comments?: string,
    conditions?: string
  ) => {
    const res = await fetch(`/api/compliance/submissions/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, comments, conditions }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Approval action failed");
    }
    await fetchSubmission();
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm("Delete this document?")) return;
    setDeletingDoc(docId);
    try {
      const res = await fetch(`/api/compliance/documents/${docId}/download`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete document");
      }
      await fetchSubmission();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete document");
    } finally {
      setDeletingDoc(null);
    }
  };

  const formatDate = (d: string | null | undefined) =>
    d ? format(new Date(d), "MMM d, yyyy") : "—";

  const formatDateTime = (d: string | null | undefined) =>
    d ? format(new Date(d), "MMM d, yyyy HH:mm") : "—";

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ height: 80, background: "var(--bg-surface)", borderRadius: 14, animation: "pulse 1.5s ease-in-out infinite" }} />
        ))}
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div style={{ textAlign: "center", padding: "64px 20px" }}>
        <AlertTriangle size={32} style={{ color: "#ef4444", margin: "0 auto 12px" }} />
        <p style={{ color: "#ef4444", fontWeight: 600, fontSize: 15 }}>{error ?? "Not found"}</p>
        <Link href="/compliance/submissions" style={{ marginTop: 12, display: "inline-block", color: "var(--brand-500)", fontSize: 13 }}>
          ← Back to submissions
        </Link>
      </div>
    );
  }

  const TABS = [
    { key: "overview", label: "Overview" },
    { key: "documents", label: `Documents (${submission.documents?.length ?? 0})` },
    { key: "approvals", label: `Approvals (${submission.approvals?.length ?? 0})` },
    { key: "history", label: "History" },
  ] as const;

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20, fontSize: 13 }}>
        <Link href="/compliance" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Compliance</Link>
        <ChevronRight size={12} style={{ color: "var(--text-muted)" }} />
        <Link href="/compliance/submissions" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Submissions</Link>
        <ChevronRight size={12} style={{ color: "var(--text-muted)" }} />
        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{submission.title}</span>
      </div>

      {/* Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "20px 24px",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: 1 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: `${submission.category?.color ?? "#6366f1"}18`,
                border: `1px solid ${submission.category?.color ?? "#6366f1"}30`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={20} color={submission.category?.color ?? "#6366f1"} />
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                {submission.title}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <StatusBadge status={submission.status as ComplianceStatus} />
                {submission.category && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: submission.category.color,
                      background: `${submission.category.color}18`,
                      border: `1px solid ${submission.category.color}30`,
                      padding: "2px 8px",
                      borderRadius: 99,
                    }}
                  >
                    {submission.category.name}
                  </span>
                )}
                {submission.type && (
                  <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "2px 8px", borderRadius: 99 }}>
                    {submission.type.name}
                  </span>
                )}
                {submission.referenceNumber && (
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Ref: #{submission.referenceNumber}
                  </span>
                )}
              </div>
              {submission.tags && submission.tags.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {submission.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 10,
                        color: "#6366f1",
                        background: "rgba(99,102,241,0.1)",
                        border: "1px solid rgba(99,102,241,0.25)",
                        padding: "1px 6px",
                        borderRadius: 99,
                        fontWeight: 600,
                      }}
                    >
                      <Tag size={8} />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              className="btn-ghost"
              onClick={fetchSubmission}
              style={{ padding: "8px 12px" }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Key dates row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
          }}
        >
          {[
            { label: "Due Date", value: submission.dueDate, icon: Calendar },
            { label: "Submission Date", value: submission.submissionDate, icon: Clock },
            { label: "Effective Date", value: submission.effectiveDate, icon: Calendar },
            { label: "Expiry Date", value: submission.expiryDate, icon: AlertTriangle },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                <Icon size={11} style={{ color: "var(--text-muted)" }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {label}
                </span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, color: value ? "var(--text-primary)" : "var(--text-muted)" }}>
                {formatDate(value)}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Tabs + Content */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
        {/* Main Panel */}
        <div>
          {/* Tab Nav */}
          <div
            style={{
              display: "flex",
              gap: 2,
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 4,
              marginBottom: 16,
            }}
          >
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1,
                  padding: "7px 10px",
                  borderRadius: 9,
                  border: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background: activeTab === tab.key ? "var(--bg-elevated)" : "transparent",
                  color: activeTab === tab.key ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Details</h3>
                </div>
                <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
                  {submission.description && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                        Description
                      </p>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        {submission.description}
                      </p>
                    </div>
                  )}
                  {submission.notes && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                        Notes
                      </p>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        {submission.notes}
                      </p>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[
                      { label: "Version", value: `v${submission.version}` },
                      { label: "Created", value: formatDateTime(submission.createdAt) },
                      { label: "Last Updated", value: formatDateTime(submission.updatedAt) },
                      { label: "Renewal Date", value: formatDate(submission.renewalDate) },
                      ...(submission.penaltyAmount
                        ? [{ label: "Penalty Amount", value: `₹${Number(submission.penaltyAmount).toLocaleString("en-IN")}` }]
                        : []),
                      ...(submission.feeAmount
                        ? [{ label: "Fee Amount", value: `₹${Number(submission.feeAmount).toLocaleString("en-IN")}` }]
                        : []),
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                          {label}
                        </p>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "documents" && (
            <motion.div key="documents" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Documents</h3>
                  <button className="btn-brand" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => setShowUpload(true)}>
                    <Upload size={12} /> Upload
                  </button>
                </div>

                {!submission.documents?.length ? (
                  <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <FileText size={28} style={{ color: "var(--text-muted)", margin: "0 auto 10px" }} />
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No documents uploaded yet</p>
                    <button className="btn-brand" style={{ marginTop: 12 }} onClick={() => setShowUpload(true)}>
                      <Upload size={13} /> Upload First Document
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: "8px 0" }}>
                    {submission.documents.map((doc) => (
                      <div
                        key={doc.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "12px 18px",
                          borderBottom: "1px solid var(--border)",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: "rgba(99,102,241,0.12)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <FileText size={16} color="#6366f1" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {doc.fileName}
                          </p>
                          <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatSize(doc.fileSize)}</span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>v{doc.version}</span>
                            {doc.documentType && (
                              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{doc.documentType}</span>
                            )}
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {format(new Date(doc.uploadedAt), "MMM d, yyyy")}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <a
                            href={`/api/compliance/documents/${doc.id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "5px 10px",
                              background: "rgba(59,130,246,0.12)",
                              border: "1px solid rgba(59,130,246,0.3)",
                              borderRadius: 6,
                              color: "#3b82f6",
                              fontSize: 11,
                              fontWeight: 600,
                              textDecoration: "none",
                            }}
                          >
                            <Download size={11} /> Download
                          </a>
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            disabled={deletingDoc === doc.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              padding: "5px 8px",
                              background: "none",
                              border: "1px solid var(--border)",
                              borderRadius: 6,
                              color: "var(--text-muted)",
                              cursor: "pointer",
                              opacity: deletingDoc === doc.id ? 0.5 : 1,
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "approvals" && (
            <motion.div key="approvals" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ApprovalPanel
                submissionId={submission.id}
                submissionStatus={submission.status}
                approvals={submission.approvals ?? []}
                onApprove={handleApprove}
              />
            </motion.div>
          )}

          {activeTab === "history" && (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Activity Timeline</h3>
                <AuditTimeline
                  auditLogs={submission.auditLogs ?? []}
                  statusHistory={submission.statusHistory ?? []}
                />
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Quick Stats */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {[
              { label: "Documents", value: submission._count?.documents ?? 0 },
              { label: "Approvals", value: submission._count?.approvals ?? 0 },
              { label: "Version", value: `v${submission.version}` },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Submit for review */}
          {submission.status === "DRAFT" && (
            <button
              className="btn-brand"
              style={{ width: "100%" }}
              onClick={async () => {
                try {
                  const res = await fetch(`/api/compliance/submissions/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "SUBMITTED" }),
                  });
                  if (!res.ok) throw new Error("Failed to submit");
                  await fetchSubmission();
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              Submit for Review
            </button>
          )}

          {/* Status History quick view */}
          {(submission.statusHistory?.length ?? 0) > 0 && (
            <div
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Status History</h4>
              </div>
              <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                {(submission.statusHistory ?? []).slice(0, 4).map((h) => (
                  <div key={h.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    <StatusBadge status={h.toStatus} size="sm" />
                    <span style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {format(new Date(h.changedAt), "MMM d, HH:mm")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deadlines */}
          {(submission.deadlines?.length ?? 0) > 0 && (
            <div
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Deadlines</h4>
              </div>
              <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                {(submission.deadlines ?? []).map((d) => (
                  <div key={d.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: d.isCompleted ? "#10b981" : "var(--text-primary)" }}>
                        {d.title}
                      </span>
                      {d.isCompleted && (
                        <span style={{ fontSize: 10, color: "#10b981", fontWeight: 600 }}>✓</span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {format(new Date(d.deadlineDate), "MMM d, yyyy")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showUpload && (
        <UploadDocumentModal
          submissionId={submission.id}
          submissionTitle={submission.title}
          onClose={() => setShowUpload(false)}
          onSuccess={fetchSubmission}
        />
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
