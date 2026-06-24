"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { FileText, Plus, X, Send, CheckCircle2, XCircle, Eye } from "lucide-react";

export interface PortalUploadRow {
  id: string;
  fileName: string;
  fileUrl: string;
  status: string;
  reviewNotes: string | null;
  createdAt: string;
}
export interface DocRequestRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
  customerName: string;
  uploads: PortalUploadRow[];
}
export interface CustomerOption {
  id: string;
  name: string;
}

const CATEGORIES = ["GST", "INCOME_TAX", "TDS", "AUDIT", "ROC", "PAYROLL", "BANK_STATEMENTS", "INVOICES", "OTHER"];

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#f59e0b",
  UPLOADED: "#3b82f6",
  UNDER_REVIEW: "#8b5cf6",
  PENDING_REVIEW: "#f59e0b",
  APPROVED: "#10b981",
  REJECTED: "#ef4444",
  CANCELLED: "#94a3b8",
};

function Badge({ status }: { status: string }) {
  const c = STATUS_COLOR[status] ?? "#94a3b8";
  return (
    <span className="badge" style={{ background: `${c}18`, color: c, borderColor: `${c}30` }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function DocumentRequestsClient({
  requests,
  customers,
}: {
  requests: DocRequestRow[];
  customers: CustomerOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ customerId: "", title: "", description: "", category: "OTHER", dueDate: "" });
  const [submitting, setSubmitting] = useState(false);

  const openCount = requests.filter((r) => !["APPROVED", "REJECTED", "CANCELLED"].includes(r.status)).length;
  const reviewCount = requests.reduce(
    (n, r) => n + r.uploads.filter((u) => u.status === "PENDING_REVIEW" || u.status === "UNDER_REVIEW").length,
    0
  );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/document-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: form.customerId,
          title: form.title.trim(),
          description: form.description.trim() || null,
          category: form.category,
          dueDate: form.dueDate || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to create request");
      setOpen(false);
      setForm({ customerId: "", title: "", description: "", category: "OTHER", dueDate: "" });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function review(uploadId: string, status: string) {
    let reviewNotes: string | null = null;
    if (status === "REJECTED") {
      reviewNotes = window.prompt("Reason for rejection (optional):") ?? null;
    }
    setBusy(uploadId);
    setError(null);
    try {
      const res = await fetch(`/api/portal/uploads/${uploadId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNotes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Review failed");
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="section-title">Document Requests</h1>
          <p className="section-subtitle">Request documents from clients and review what they upload</p>
        </div>
        <button className="btn-brand" onClick={() => setOpen(true)} disabled={customers.length === 0}>
          <Plus size={15} /> New Request
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Open Requests", value: openCount, color: "#f59e0b" },
          { label: "Awaiting Review", value: reviewCount, color: "#8b5cf6" },
          { label: "Total", value: requests.length, color: "#6366f1" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <FileText size={44} color="var(--text-muted)" />
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>No document requests yet</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", maxWidth: 340 }}>
              Create a request to ask a client for specific documents. They&apos;ll be notified in their portal.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {requests.map((r) => (
            <div key={r.id} className="section-card">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{r.title}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {r.customerName} · {r.category.replace(/_/g, " ")}
                    {r.dueDate ? ` · due ${format(new Date(r.dueDate), "dd MMM")}` : ""}
                  </p>
                  {r.description && <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>{r.description}</p>}
                </div>
                <Badge status={r.status} />
              </div>

              {r.uploads.length > 0 && (
                <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {r.uploads.map((u) => (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <FileText size={14} color="var(--text-muted)" />
                      <a href={u.fileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "var(--text-primary)", textDecoration: "none", flex: 1, minWidth: 120 }}>
                        {u.fileName}
                      </a>
                      <Badge status={u.status} />
                      {u.status !== "APPROVED" && u.status !== "REJECTED" && (
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button className="btn-ghost" disabled={busy === u.id} onClick={() => review(u.id, "UNDER_REVIEW")} style={{ fontSize: 12, padding: "4px 8px" }} title="Mark under review">
                            <Eye size={12} />
                          </button>
                          <button className="btn-ghost" disabled={busy === u.id} onClick={() => review(u.id, "APPROVED")} style={{ fontSize: 12, padding: "4px 8px", color: "#10b981" }}>
                            <CheckCircle2 size={12} /> Approve
                          </button>
                          <button className="btn-ghost" disabled={busy === u.id} onClick={() => review(u.id, "REJECTED")} style={{ fontSize: 12, padding: "4px 8px", color: "#ef4444" }}>
                            <XCircle size={12} /> Reject
                          </button>
                        </div>
                      )}
                      {u.reviewNotes && <p style={{ width: "100%", fontSize: 11, color: "#ef4444" }}>Note: {u.reviewNotes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {open && (
        <div onClick={() => !submitting && setOpen(false)} style={modalBackdrop}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={create} className="section-card" style={{ width: "100%", maxWidth: 440, margin: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>New document request</h2>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost" style={{ padding: 6 }}><X size={16} /></button>
            </div>
            <label style={labelStyle}>Client *</label>
            <select className="input" required value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} style={{ marginBottom: 12 }}>
              <option value="">Select a client…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label style={labelStyle}>What do you need? *</label>
            <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. April bank statement" style={{ marginBottom: 12 }} />
            <label style={labelStyle}>Category</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ marginBottom: 12 }}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
            </select>
            <label style={labelStyle}>Due date</label>
            <input className="input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} style={{ marginBottom: 12 }} />
            <label style={labelStyle}>Details</label>
            <textarea className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Optional instructions" style={{ marginBottom: 16, resize: "vertical" }} />
            <button type="submit" className="btn-brand" disabled={submitting} style={{ width: "100%", justifyContent: "center" }}>
              <Send size={15} /> {submitting ? "Creating…" : "Send Request"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const modalBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  padding: 16,
};
const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 5 };
