"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Inbox, UploadCloud, X, Send } from "lucide-react";

export interface CustomerDocRequestRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  dueDate: string | null;
  uploads: { id: string; fileName: string; status: string; reviewNotes: string | null }[];
}

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
  return <span className="badge" style={{ background: `${c}18`, color: c, borderColor: `${c}30` }}>{status.replace(/_/g, " ")}</span>;
}

export function CustomerDocumentRequests({ requests }: { requests: CustomerDocRequestRow[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<CustomerDocRequestRow | null>(null);
  const [form, setForm] = useState({ fileName: "", fileUrl: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = requests.filter((r) => !["APPROVED", "REJECTED", "CANCELLED"].includes(r.status));

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/document-requests/${target.id}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: form.fileName.trim(), fileUrl: form.fileUrl.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Upload failed");
      setTarget(null);
      setForm({ fileName: "", fileUrl: "" });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (requests.length === 0) return null;

  return (
    <div className="section-card" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Inbox size={16} color="#6366f1" />
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Requested by your CA</h2>
        {open.length > 0 && (
          <span className="badge" style={{ background: "#f59e0b18", color: "#f59e0b", borderColor: "#f59e0b30" }}>{open.length} open</span>
        )}
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {requests.map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{r.title}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {r.category.replace(/_/g, " ")}
                {r.dueDate ? ` · due ${format(new Date(r.dueDate), "dd MMM")}` : ""}
              </p>
              {r.uploads.map((u) => (
                <p key={u.id} style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                  {u.fileName} — <span style={{ color: STATUS_COLOR[u.status] }}>{u.status.replace(/_/g, " ")}</span>
                  {u.reviewNotes ? ` (${u.reviewNotes})` : ""}
                </p>
              ))}
            </div>
            <Badge status={r.status} />
            {!["APPROVED", "REJECTED", "CANCELLED"].includes(r.status) && (
              <button className="btn-brand" onClick={() => setTarget(r)} style={{ fontSize: 12, padding: "6px 12px" }}>
                <UploadCloud size={13} /> Upload
              </button>
            )}
          </div>
        ))}
      </div>

      {target && (
        <div onClick={() => !submitting && setTarget(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={upload} className="section-card" style={{ width: "100%", maxWidth: 420, margin: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Upload document</h2>
              <button type="button" onClick={() => setTarget(null)} className="btn-ghost" style={{ padding: 6 }}><X size={16} /></button>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>For: {target.title}</p>
            <label style={labelStyle}>File name *</label>
            <input className="input" required value={form.fileName} onChange={(e) => setForm({ ...form, fileName: e.target.value })} placeholder="e.g. bank-statement-april.pdf" style={{ marginBottom: 12 }} />
            <label style={labelStyle}>File URL *</label>
            <input className="input" required value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} placeholder="https://…" style={{ marginBottom: 16 }} />
            <button type="submit" className="btn-brand" disabled={submitting} style={{ width: "100%", justifyContent: "center" }}>
              <Send size={15} /> {submitting ? "Uploading…" : "Submit Document"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 5 };
