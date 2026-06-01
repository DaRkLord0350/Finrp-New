"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { PenLine, Plus, X, Eye, CheckCircle2, XCircle, Clock, Send, FileSignature } from "lucide-react";

interface SignatureEvent {
  id: string;
  event: string;
  description: string | null;
  createdAt: string;
}

interface SignatureRequest {
  id: string;
  title: string;
  description: string | null;
  documentUrl: string;
  signerEmail: string;
  signerName: string | null;
  caEmail: string | null;
  status: string;
  signedDocUrl: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  rejectedAt: string | null;
  expiresAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  events: SignatureEvent[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.FC<{ size: number }> }> = {
  PENDING: { label: "Pending", color: "#f59e0b", icon: Clock },
  SENT: { label: "Sent", color: "#0ea5e9", icon: Send },
  VIEWED: { label: "Viewed", color: "#8b5cf6", icon: Eye },
  SIGNED: { label: "Signed", color: "#10b981", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", color: "#ef4444", icon: XCircle },
  EXPIRED: { label: "Expired", color: "#94a3b8", icon: Clock },
  CANCELLED: { label: "Cancelled", color: "#94a3b8", icon: XCircle },
};

export default function ESignPage() {
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<SignatureRequest | null>(null);
  const [form, setForm] = useState({ title: "", description: "", documentUrl: "", signerEmail: "", signerName: "", caEmail: "", expiresAt: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/firm/esign");
    const data = await res.json();
    setRequests(data.requests ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/firm/esign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ title: "", description: "", documentUrl: "", signerEmail: "", signerName: "", caEmail: "", expiresAt: "" });
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string, event: string) => {
    await fetch(`/api/firm/esign/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, event }),
    });
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    if (selected?.id === id) setSelected((s) => s ? { ...s, status } : s);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this signature request?")) return;
    await fetch(`/api/firm/esign/${id}`, { method: "DELETE" });
    setRequests((prev) => prev.filter((r) => r.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const byStatus = {
    ALL: requests.length,
    PENDING: requests.filter((r) => r.status === "PENDING").length,
    SENT: requests.filter((r) => r.status === "SENT").length,
    SIGNED: requests.filter((r) => r.status === "SIGNED").length,
    REJECTED: requests.filter((r) => r.status === "REJECTED").length,
  };

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 className="section-title">E-Signatures</h1>
          <p className="section-subtitle">{requests.length} signature request{requests.length !== 1 ? "s" : ""}</p>
        </div>
        <button className="btn-brand" onClick={() => setShowModal(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={15} /> New Request
        </button>
      </div>

      {/* Status Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
        {Object.entries(byStatus).map(([status, count]) => {
          const cfg = STATUS_CONFIG[status] ?? { label: status, color: "#6366f1", icon: FileSignature };
          const Icon = cfg.icon as React.FC<{ size: number }>;
          return (
            <div key={status} style={{ padding: "14px 16px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Icon size={13} />
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{status === "ALL" ? "Total" : cfg.label}</span>
              </div>
              <p style={{ fontSize: 22, fontWeight: 700, color: status === "ALL" ? "var(--text-primary)" : cfg.color }}>{count}</p>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="section-card"><div className="empty-state"><div className="loading-spinner" /></div></div>
      ) : requests.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <FileSignature size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No signature requests yet</p>
            <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", maxWidth: 320 }}>Create signature requests to collect e-signatures from clients and CAs.</p>
            <button className="btn-brand" onClick={() => setShowModal(true)}>Create first request</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 400px" : "1fr", gap: 20 }}>
          <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Signer</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.PENDING;
                  const Icon = cfg.icon as React.FC<{ size: number }>;
                  return (
                    <tr key={r.id} style={{ cursor: "pointer", background: selected?.id === r.id ? "var(--bg-elevated)" : undefined }}
                      onClick={() => setSelected(r)}>
                      <td>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{r.title}</p>
                        {r.description && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.description}</p>}
                      </td>
                      <td>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.signerName ?? "—"}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.signerEmail}</p>
                      </td>
                      <td>
                        <span className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${cfg.color}18`, color: cfg.color, borderColor: `${cfg.color}30` }}>
                          <Icon size={11} /> {cfg.label}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{format(new Date(r.createdAt), "dd MMM yyyy")}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {r.status === "PENDING" && (
                            <button onClick={(e) => { e.stopPropagation(); updateStatus(r.id, "SENT", "sent"); }}
                              style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(14,165,233,0.3)", background: "rgba(14,165,233,0.1)", color: "#0ea5e9", fontSize: 11, cursor: "pointer" }}>
                              Mark Sent
                            </button>
                          )}
                          {r.status === "SENT" && (
                            <button onClick={(e) => { e.stopPropagation(); updateStatus(r.id, "SIGNED", "signed"); }}
                              style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.1)", color: "#10b981", fontSize: 11, cursor: "pointer" }}>
                              Mark Signed
                            </button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                            style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 11, cursor: "pointer" }}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Detail Panel */}
          {selected && (
            <div className="section-card" style={{ alignSelf: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Request Details</h3>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={15} /></button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Title", value: selected.title },
                  { label: "Signer", value: `${selected.signerName ?? ""} (${selected.signerEmail})` },
                  { label: "CA Email", value: selected.caEmail },
                  { label: "Status", value: STATUS_CONFIG[selected.status]?.label ?? selected.status },
                  { label: "Sent", value: selected.sentAt ? format(new Date(selected.sentAt), "dd MMM yyyy HH:mm") : "—" },
                  { label: "Viewed", value: selected.viewedAt ? format(new Date(selected.viewedAt), "dd MMM yyyy HH:mm") : "—" },
                  { label: "Signed", value: selected.signedAt ? format(new Date(selected.signedAt), "dd MMM yyyy HH:mm") : "—" },
                  { label: "Expires", value: selected.expiresAt ? format(new Date(selected.expiresAt), "dd MMM yyyy") : "—" },
                ].map((f) => (
                  <div key={f.label} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{f.label}</span>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", textAlign: "right", maxWidth: 180 }}>{f.value ?? "—"}</span>
                  </div>
                ))}
              </div>

              {selected.events.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Audit Trail</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {selected.events.map((ev) => (
                      <div key={ev.id} style={{ display: "flex", gap: 8, fontSize: 12 }}>
                        <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{format(new Date(ev.createdAt), "dd MMM HH:mm")}</span>
                        <span style={{ color: "var(--text-secondary)" }}>{ev.event}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.signedDocUrl && (
                <a href={selected.signedDocUrl} target="_blank" rel="noopener noreferrer" className="btn-brand" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14, textDecoration: "none" }}>
                  <FileSignature size={14} /> Download Signed Doc
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, boxShadow: "var(--shadow-lg)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>New Signature Request</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Document Title *", key: "title", required: true, placeholder: "e.g. GST Return Q1 2025 — Signature Required" },
                { label: "Document URL *", key: "documentUrl", required: true, placeholder: "https://..." },
                { label: "Signer Email *", key: "signerEmail", required: true, placeholder: "client@example.com" },
                { label: "Signer Name", key: "signerName", required: false, placeholder: "Full name" },
                { label: "CA Email (also signs)", key: "caEmail", required: false, placeholder: "ca@firm.com" },
              ].map((field) => (
                <div key={field.key}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>{field.label}</label>
                  <input
                    required={field.required}
                    value={(form as Record<string, string>)[field.key]}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none" }}
                  />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Optional notes..."
                  style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none", resize: "vertical" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Expiry Date</label>
                <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none" }} />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-brand" disabled={saving}>{saving ? "Creating..." : "Create Request"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
