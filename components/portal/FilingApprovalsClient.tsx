"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { BadgeCheck, Plus, X, Send, CheckCircle2, XCircle, FileText, Paperclip } from "lucide-react";

export interface FilingDocRow { id: string; fileName: string; fileUrl: string }
export interface FilingCommentRow { id: string; authorName: string | null; body: string; createdAt: string }
export interface FilingRow {
  id: string;
  type: string;
  title: string;
  period: string | null;
  summary: string | null;
  amount: string | null;
  status: string;
  customerName: string;
  customerComment: string | null;
  createdAt: string;
  decidedAt: string | null;
  documents: FilingDocRow[];
  comments: FilingCommentRow[];
}
export interface CustomerOption { id: string; name: string }

const FILING_TYPES = ["GST", "ITR", "TDS", "ROC", "OTHER"];
const STATUS_COLOR: Record<string, string> = {
  DRAFT: "#94a3b8",
  PENDING: "#f59e0b",
  APPROVED: "#10b981",
  REJECTED: "#ef4444",
  FILED: "#3b82f6",
};

function Badge({ status }: { status: string }) {
  const c = STATUS_COLOR[status] ?? "#94a3b8";
  return <span className="badge" style={{ background: `${c}18`, color: c, borderColor: `${c}30` }}>{status}</span>;
}

export function FilingApprovalsClient({
  filings,
  mode,
  customers = [],
}: {
  filings: FilingRow[];
  mode: "ca" | "customer";
  customers?: CustomerOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = filings.filter((f) => f.status === "PENDING").length;
  const approved = filings.filter((f) => f.status === "APPROVED" || f.status === "FILED").length;

  async function decide(id: string, approve: boolean) {
    let comment: string | null = null;
    if (!approve) comment = window.prompt("Reason for rejection (optional):") ?? null;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/portal/filings/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve, comment }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Action failed");
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
          <h1 className="section-title">{mode === "ca" ? "Filing Approvals" : "Approvals"}</h1>
          <p className="section-subtitle">
            {mode === "ca" ? "Send GST/ITR filings to clients for e-approval" : "Review and approve filings prepared by your CA"}
          </p>
        </div>
        {mode === "ca" && (
          <button className="btn-brand" onClick={() => setOpen(true)} disabled={customers.length === 0}>
            <Plus size={15} /> New Filing
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: mode === "ca" ? "Awaiting Client" : "Awaiting Your Approval", value: pending, color: "#f59e0b" },
          { label: "Approved", value: approved, color: "#10b981" },
          { label: "Total", value: filings.length, color: "#6366f1" },
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

      {filings.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <BadgeCheck size={44} color="var(--text-muted)" />
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>No filings yet</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", maxWidth: 340 }}>
              {mode === "ca" ? "Create a filing approval to send to a client." : "Filings sent by your CA will appear here for approval."}
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filings.map((f) => (
            <div key={f.id} className="section-card">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="badge" style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1", borderColor: "rgba(99,102,241,0.3)" }}>{f.type}</span>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{f.title}</p>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    {mode === "ca" ? `${f.customerName} · ` : ""}{f.period ?? "—"}
                    {f.amount ? ` · ₹${Number(f.amount).toLocaleString("en-IN")}` : ""}
                  </p>
                  {f.summary && <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>{f.summary}</p>}
                  {f.documents.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                      {f.documents.map((d) => (
                        <a key={d.id} href={d.fileUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--brand-400, #818cf8)", textDecoration: "none" }}>
                          <FileText size={12} /> {d.fileName}
                        </a>
                      ))}
                    </div>
                  )}
                  {f.customerComment && (
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                      Client note: <span style={{ color: "var(--text-secondary)" }}>{f.customerComment}</span>
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <Badge status={f.status} />
                  {mode === "customer" && f.status === "PENDING" && (
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <button className="btn-brand" disabled={busy === f.id} onClick={() => decide(f.id, true)} style={{ fontSize: 12, padding: "6px 12px" }}>
                        <CheckCircle2 size={13} /> Approve
                      </button>
                      <button className="btn-ghost" disabled={busy === f.id} onClick={() => decide(f.id, false)} style={{ fontSize: 12, padding: "6px 12px", color: "#ef4444" }}>
                        <XCircle size={13} /> Reject
                      </button>
                    </div>
                  )}
                  {f.decidedAt && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{format(new Date(f.decidedAt), "dd MMM yyyy")}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && mode === "ca" && (
        <NewFilingModal customers={customers} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); router.refresh(); }} setError={setError} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function NewFilingModal({
  customers,
  onClose,
  onCreated,
  setError,
}: {
  customers: CustomerOption[];
  onClose: () => void;
  onCreated: () => void;
  setError: (s: string | null) => void;
}) {
  const [form, setForm] = useState({ customerId: "", type: "GST", title: "", period: "", summary: "", amount: "" });
  const [docs, setDocs] = useState<{ fileName: string; fileUrl: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/filings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: form.customerId,
          type: form.type,
          title: form.title.trim(),
          period: form.period.trim() || null,
          summary: form.summary.trim() || null,
          amount: form.amount ? Number(form.amount) : null,
          documents: docs.filter((d) => d.fileName && d.fileUrl),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to create filing");
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div onClick={() => !submitting && onClose()} style={modalBackdrop}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="section-card" style={{ width: "100%", maxWidth: 460, margin: 0, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>New filing approval</h2>
          <button type="button" onClick={onClose} className="btn-ghost" style={{ padding: 6 }}><X size={16} /></button>
        </div>
        <label style={labelStyle}>Client *</label>
        <select className="input" required value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} style={{ marginBottom: 12 }}>
          <option value="">Select a client…</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ marginBottom: 12 }}>
              {FILING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Period</label>
            <input className="input" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="e.g. May 2026" style={{ marginBottom: 12 }} />
          </div>
        </div>
        <label style={labelStyle}>Title *</label>
        <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. GSTR-3B — May 2026" style={{ marginBottom: 12 }} />
        <label style={labelStyle}>Tax / amount payable (₹)</label>
        <input className="input" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" style={{ marginBottom: 12 }} />
        <label style={labelStyle}>Summary</label>
        <textarea className="input" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={2} placeholder="What the client is approving" style={{ marginBottom: 12, resize: "vertical" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Documents (GST/ITR)</label>
          <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: "4px 8px" }} onClick={() => setDocs([...docs, { fileName: "", fileUrl: "" }])}>
            <Paperclip size={12} /> Add
          </button>
        </div>
        {docs.map((d, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input className="input" value={d.fileName} onChange={(e) => setDocs(docs.map((x, j) => (j === i ? { ...x, fileName: e.target.value } : x)))} placeholder="File name" style={{ flex: 1 }} />
            <input className="input" value={d.fileUrl} onChange={(e) => setDocs(docs.map((x, j) => (j === i ? { ...x, fileUrl: e.target.value } : x)))} placeholder="File URL" style={{ flex: 1 }} />
            <button type="button" className="btn-ghost" style={{ padding: 6 }} onClick={() => setDocs(docs.filter((_, j) => j !== i))}><X size={14} /></button>
          </div>
        ))}

        <button type="submit" className="btn-brand" disabled={submitting} style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>
          <Send size={15} /> {submitting ? "Sending…" : "Send for Approval"}
        </button>
      </form>
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
