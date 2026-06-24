"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { UserPlus, RefreshCw, X, Send, Mail } from "lucide-react";

export interface CAInviteRow {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  status: string;
  resendCount: number;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#f59e0b",
  SENT: "#6366f1",
  ACCEPTED: "#10b981",
  EXPIRED: "#ef4444",
  REVOKED: "#94a3b8",
};

export function CAOnboarding({ invites }: { invites: CAInviteRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", name: "", company: "", message: "" });

  const active = invites.filter((i) => i.status === "PENDING" || i.status === "SENT").length;
  const onboarded = invites.filter((i) => i.status === "ACCEPTED").length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/ca/customers/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          name: form.name.trim() || null,
          company: form.company.trim() || null,
          message: form.message.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to send invitation");
      setOpen(false);
      setForm({ email: "", name: "", company: "", message: "" });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function action(url: string, method: "POST" | "DELETE", id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(url, { method });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Action failed");
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="section-card" style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Customer Onboarding</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {active} awaiting · {onboarded} onboarded
          </p>
        </div>
        <button className="btn-brand" onClick={() => setOpen(true)}>
          <UserPlus size={15} /> Invite Customer
        </button>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {invites.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 4px", color: "var(--text-muted)", fontSize: 13 }}>
          <Mail size={16} /> No invitations sent yet. Invite a customer to start onboarding them.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Status</th>
                <th>Invited</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((r) => {
                const color = STATUS_COLOR[r.status] ?? "#94a3b8";
                const closed = r.status === "ACCEPTED" || r.status === "REVOKED";
                const busy = busyId === r.id;
                return (
                  <tr key={r.id}>
                    <td>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{r.name ?? r.email}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {r.email}{r.company ? ` · ${r.company}` : ""}
                      </p>
                    </td>
                    <td>
                      <span className="badge" style={{ background: `${color}18`, color, borderColor: `${color}30` }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{format(new Date(r.createdAt), "dd MMM yyyy")}</td>
                    <td style={{ textAlign: "right" }}>
                      {!closed ? (
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button className="btn-ghost" disabled={busy} onClick={() => action(`/api/ca/customers/invite/${r.id}/resend`, "POST", r.id)} style={{ fontSize: 12, padding: "5px 10px" }}>
                            <RefreshCw size={12} /> Resend
                          </button>
                          <button className="btn-ghost" disabled={busy} onClick={() => action(`/api/ca/customers/invite/${r.id}`, "DELETE", r.id)} style={{ fontSize: 12, padding: "5px 10px", color: "#ef4444" }}>
                            <X size={12} /> Cancel
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div
          onClick={() => !submitting && setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
        >
          <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="section-card" style={{ width: "100%", maxWidth: 420, margin: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Invite a customer</h2>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost" style={{ padding: 6 }}>
                <X size={16} />
              </button>
            </div>
            <label style={labelStyle}>Email *</label>
            <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="client@example.com" style={{ marginBottom: 12 }} />
            <label style={labelStyle}>Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Contact name" style={{ marginBottom: 12 }} />
            <label style={labelStyle}>Company</label>
            <input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company / business name" style={{ marginBottom: 12 }} />
            <label style={labelStyle}>Personal note (optional)</label>
            <textarea className="input" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={3} placeholder="Add a short message to the invitation email" style={{ marginBottom: 16, resize: "vertical" }} />
            <button type="submit" className="btn-brand" disabled={submitting} style={{ width: "100%", justifyContent: "center" }}>
              <Send size={15} /> {submitting ? "Sending…" : "Send Invitation"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: 5,
};
