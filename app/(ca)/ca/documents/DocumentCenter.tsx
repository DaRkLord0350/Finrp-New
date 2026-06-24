"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  FolderOpen,
  Check,
  X,
  RotateCcw,
  PenLine,
  History,
  Upload,
  Plus,
  Loader2,
} from "lucide-react";

type Decision = "NONE" | "PENDING" | "APPROVED" | "REJECTED" | "REUPLOAD_REQUESTED";

export interface CustomerOption {
  id: string;
  name: string;
}
export interface DocRow {
  id: string;
  customerId: string;
  customerName: string;
  displayName: string;
  fileName: string;
  fileUrl: string;
  folder: string;
  currentVersion: number;
  createdAt: string;
  decision: Decision;
  reviewComment: string | null;
  signatureRequested: boolean;
  versions: { versionNumber: number; fileUrl: string; fileName: string; createdAt: string }[];
}

const DECISION_META: Record<Decision, { label: string; color: string }> = {
  NONE: { label: "Awaiting Review", color: "#94a3b8" },
  PENDING: { label: "In Review", color: "#f59e0b" },
  APPROVED: { label: "Approved", color: "#10b981" },
  REJECTED: { label: "Rejected", color: "#ef4444" },
  REUPLOAD_REQUESTED: { label: "Re-upload Requested", color: "#f97316" },
};

const FOLDERS = ["GST", "INCOME_TAX", "TDS", "AUDIT", "ROC", "PAYROLL", "BANK_STATEMENTS", "INVOICES", "OTHER"];

export default function DocumentCenter({ rows, customers }: { rows: DocRow[]; customers: CustomerOption[] }) {
  const router = useRouter();
  const [customerFilter, setCustomerFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | Decision>("ALL");
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (customerFilter === "ALL" || r.customerId === customerFilter) &&
          (statusFilter === "ALL" || r.decision === statusFilter)
      ),
    [rows, customerFilter, statusFilter]
  );

  const review = async (id: string, decision: Decision, opts: { comment?: string; requestSignature?: boolean } = {}) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/ca/documents/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, ...opts }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        alert(d?.error ?? "Action failed");
      } else {
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  };

  const onReject = (id: string) => {
    const comment = window.prompt("Reason for rejection (shared with client):");
    if (comment === null) return;
    review(id, "REJECTED", { comment });
  };
  const onReupload = (id: string) => {
    const comment = window.prompt("What needs to be re-uploaded?");
    if (comment === null) return;
    review(id, "REUPLOAD_REQUESTED", { comment });
  };

  return (
    <>
      {/* Controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="ca-select">
          <option value="ALL">All clients</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Decision | "ALL")} className="ca-select">
          <option value="ALL">All statuses</option>
          {(Object.keys(DECISION_META) as Decision[]).map((d) => <option key={d} value={d}>{DECISION_META[d].label}</option>)}
        </select>
        <button onClick={() => setShowUpload((s) => !s)} className="ca-btn-primary" style={{ marginLeft: "auto" }}>
          <Plus size={14} /> Upload Document
        </button>
      </div>

      {showUpload && (
        <UploadForm customers={customers} onDone={() => { setShowUpload(false); router.refresh(); }} />
      )}

      {filtered.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <FolderOpen size={44} color="var(--text-muted)" />
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>No documents</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Upload a document or adjust your filters.</p>
          </div>
        </div>
      ) : (
        <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr><th>Document</th><th>Client</th><th>Folder</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const meta = DECISION_META[r.decision];
                const isBusy = busy === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr>
                      <td>
                        <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{r.displayName}</p>
                          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            v{r.currentVersion} · {r.fileName}
                            {r.signatureRequested && <span style={{ color: "#0ea5e9" }}> · E-sign sent</span>}
                          </p>
                        </a>
                      </td>
                      <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{r.customerName}</td>
                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.folder.replace("_", " ")}</td>
                      <td>
                        <span className="badge" style={{ background: `${meta.color}1a`, color: meta.color, borderColor: `${meta.color}30` }}>{meta.label}</span>
                        {r.reviewComment && <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 3, maxWidth: 200 }}>{r.reviewComment}</p>}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                          {isBusy ? (
                            <Loader2 size={15} className="animate-spin" color="var(--text-muted)" />
                          ) : (
                            <>
                              <IconBtn title="Approve" color="#10b981" onClick={() => review(r.id, "APPROVED")}><Check size={14} /></IconBtn>
                              <IconBtn title="Reject" color="#ef4444" onClick={() => onReject(r.id)}><X size={14} /></IconBtn>
                              <IconBtn title="Request re-upload" color="#f97316" onClick={() => onReupload(r.id)}><RotateCcw size={14} /></IconBtn>
                              <IconBtn title="Send for e-sign" color="#0ea5e9" onClick={() => review(r.id, r.decision === "NONE" ? "PENDING" : r.decision, { requestSignature: true })}><PenLine size={14} /></IconBtn>
                              {r.versions.length > 1 && (
                                <IconBtn title="Version history" color="#818cf8" onClick={() => setExpanded(expanded === r.id ? null : r.id)}><History size={14} /></IconBtn>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded === r.id && (
                      <tr>
                        <td colSpan={5} style={{ background: "var(--bg-elevated)" }}>
                          <div style={{ padding: "4px 0" }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>Version history</p>
                            {r.versions.map((v) => (
                              <div key={v.versionNumber} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0", fontSize: 12 }}>
                                <span className="badge">v{v.versionNumber}</span>
                                <a href={v.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#818cf8", textDecoration: "none" }}>{v.fileName}</a>
                                <span style={{ color: "var(--text-muted)", marginLeft: "auto" }}>{format(new Date(v.createdAt), "dd MMM yyyy")}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .ca-select { padding: 8px 10px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px; color: var(--text-secondary); font-size: 12.5px; outline: none; cursor: pointer; }
        .ca-btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border: none; border-radius: 8px; background: linear-gradient(135deg,#6366f1,#0ea5e9); color: #fff; font-size: 12.5px; font-weight: 600; cursor: pointer; }
      `}</style>
    </>
  );
}

function IconBtn({ children, title, color, onClick }: { children: React.ReactNode; title: string; color: string; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${color}30`, background: `${color}12`, color, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
    >
      {children}
    </button>
  );
}

function UploadForm({ customers, onDone }: { customers: CustomerOption[]; onDone: () => void }) {
  const [form, setForm] = useState({ customerId: customers[0]?.id ?? "", folder: "OTHER", displayName: "", fileName: "", fileUrl: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ca/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? "Upload failed");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="section-card" style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Upload size={16} color="#6366f1" />
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Upload Document</h3>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Client">
          <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} className="ca-select" style={{ width: "100%" }}>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Folder">
          <select value={form.folder} onChange={(e) => setForm({ ...form, folder: e.target.value })} className="ca-select" style={{ width: "100%" }}>
            {FOLDERS.map((f) => <option key={f} value={f}>{f.replace("_", " ")}</option>)}
          </select>
        </Field>
        <Field label="Display name">
          <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="ca-input" placeholder="e.g. PAN Card" />
        </Field>
        <Field label="File name">
          <input value={form.fileName} onChange={(e) => setForm({ ...form, fileName: e.target.value })} className="ca-input" placeholder="pan.pdf" />
        </Field>
        <Field label="File URL" full>
          <input value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} className="ca-input" placeholder="https://… or hosted file URL" />
        </Field>
      </div>
      {error && <p style={{ fontSize: 12, color: "#ef4444", marginTop: 10 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={submit} disabled={saving || !form.displayName || !form.fileName || !form.fileUrl} className="ca-btn-primary" style={{ opacity: saving ? 0.7 : 1 }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Save
        </button>
        <button onClick={onDone} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
      </div>
      <style>{`.ca-input { width: 100%; padding: 8px 10px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 12.5px; outline: none; }`}</style>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}
