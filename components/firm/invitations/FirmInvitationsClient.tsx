"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Mail, UserPlus, RefreshCw, X, Send, CheckCircle2, Clock } from "lucide-react";

// ---------------------------------------------------------------------------
// Types (serialized — no Date objects cross the server/client boundary)
// ---------------------------------------------------------------------------
export interface CustomerInviteRow {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  status: string;
  invitedByName: string | null;
  assignedCaName: string | null;
  resendCount: number;
  createdAt: string;
  expiresAt: string;
  sentAt: string | null;
  acceptedAt: string | null;
}

export interface CaInviteRow {
  id: string;
  email: string;
  name: string | null;
  firmRole: string | null;
  status: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface CaOption {
  id: string;
  name: string;
}

type Funnel = Record<string, number>;

interface Props {
  customerInvites: CustomerInviteRow[];
  customerFunnel: Funnel;
  caInvites: CaInviteRow[];
  activeCaCount: number;
  cas: CaOption[];
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#f59e0b",
  SENT: "#6366f1",
  ACCEPTED: "#10b981",
  EXPIRED: "#ef4444",
  REVOKED: "#94a3b8",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? "#94a3b8";
  return (
    <span
      className="badge"
      style={{ background: `${color}18`, color, borderColor: `${color}30` }}
    >
      {status}
    </span>
  );
}

export function FirmInvitationsClient({
  customerInvites,
  customerFunnel,
  caInvites,
  activeCaCount,
  cas,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"customers" | "team">("customers");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Invite form state
  const [form, setForm] = useState({
    email: "",
    name: "",
    company: "",
    assignedCaId: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const totalInvited = Object.values(customerFunnel).reduce((a, b) => a + b, 0);
  const awaiting = (customerFunnel.PENDING ?? 0) + (customerFunnel.SENT ?? 0);
  const onboarded = customerFunnel.ACCEPTED ?? 0;
  const expired = (customerFunnel.EXPIRED ?? 0) + (customerFunnel.REVOKED ?? 0);
  const conversion = totalInvited > 0 ? Math.round((onboarded / totalInvited) * 100) : 0;

  async function act(url: string, method: "POST" | "DELETE", id: string) {
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

  async function submitInvite(e: React.FormEvent) {
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
          assignedCaId: form.assignedCaId || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to send invitation");
      setModalOpen(false);
      setForm({ email: "", name: "", company: "", assignedCaId: "", message: "" });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const stats = [
    { label: "Total Invited", value: totalInvited, color: "#6366f1", icon: Mail },
    { label: "Awaiting Onboarding", value: awaiting, color: "#f59e0b", icon: Clock },
    { label: "Onboarded", value: onboarded, color: "#10b981", icon: CheckCircle2 },
    { label: "Active CAs", value: activeCaCount, color: "#0ea5e9", icon: UserPlus },
  ];

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div>
          <h1 className="section-title">Invitations</h1>
          <p className="section-subtitle">
            Onboarding funnel for customers and CA team members
          </p>
        </div>
        <button className="btn-brand" onClick={() => setModalOpen(true)}>
          <UserPlus size={15} /> Invite Customer
        </button>
      </div>

      {/* Funnel stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 12 }}>
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <s.icon size={16} color={s.color} />
              <p style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</p>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Conversion funnel bar */}
      <div className="section-card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            Customer onboarding conversion
          </p>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#10b981" }}>{conversion}%</span>
        </div>
        <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", background: "var(--surface-2, #1e293b18)" }}>
          {[
            { v: onboarded, c: "#10b981" },
            { v: awaiting, c: "#f59e0b" },
            { v: expired, c: "#ef4444" },
          ].map((seg, i) =>
            seg.v > 0 ? (
              <div
                key={i}
                style={{ width: `${(seg.v / Math.max(totalInvited, 1)) * 100}%`, background: seg.c }}
                title={`${seg.v}`}
              />
            ) : null
          )}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
          <span>● Onboarded {onboarded}</span>
          <span style={{ color: "#f59e0b" }}>● Awaiting {awaiting}</span>
          <span style={{ color: "#ef4444" }}>● Expired/Cancelled {expired}</span>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#ef4444",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {([
          ["customers", `Customer Invitations (${customerInvites.length})`],
          ["team", `CA Team Invitations (${caInvites.length})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={tab === key ? "btn-brand" : "btn-ghost"}
            style={{ fontSize: 13 }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "customers" ? (
        <CustomerTable rows={customerInvites} busyId={busyId} onResend={(id) => act(`/api/ca/customers/invite/${id}/resend`, "POST", id)} onCancel={(id) => act(`/api/ca/customers/invite/${id}`, "DELETE", id)} />
      ) : (
        <TeamTable rows={caInvites} busyId={busyId} onResend={(id) => act(`/api/firm/team/invite/${id}`, "POST", id)} onRevoke={(id) => act(`/api/firm/team/invite/${id}`, "DELETE", id)} />
      )}

      {/* Invite Customer modal */}
      {modalOpen && (
        <div
          onClick={() => !submitting && setModalOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitInvite}
            className="section-card"
            style={{ width: "100%", maxWidth: 440, margin: 0 }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Invite a customer</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost" style={{ padding: 6 }}>
                <X size={16} />
              </button>
            </div>

            <label style={labelStyle}>Email *</label>
            <input
              className="input"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="client@example.com"
              style={{ marginBottom: 12 }}
            />

            <label style={labelStyle}>Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Contact name"
              style={{ marginBottom: 12 }}
            />

            <label style={labelStyle}>Company</label>
            <input
              className="input"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              placeholder="Company / business name"
              style={{ marginBottom: 12 }}
            />

            <label style={labelStyle}>Assign to CA</label>
            <select
              className="input"
              value={form.assignedCaId}
              onChange={(e) => setForm({ ...form, assignedCaId: e.target.value })}
              style={{ marginBottom: 12 }}
            >
              <option value="">Me (default)</option>
              {cas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <label style={labelStyle}>Personal note (optional)</label>
            <textarea
              className="input"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Add a short message to the invitation email"
              rows={3}
              style={{ marginBottom: 16, resize: "vertical" }}
            />

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

// ---------------------------------------------------------------------------
// Customer invitations table
// ---------------------------------------------------------------------------
function CustomerTable({
  rows,
  busyId,
  onResend,
  onCancel,
}: {
  rows: CustomerInviteRow[];
  busyId: string | null;
  onResend: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="section-card">
        <div className="empty-state">
          <Mail size={44} color="var(--text-muted)" />
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>No customer invitations yet</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", maxWidth: 320 }}>
            Invite a customer to onboard onto FinRP. They&apos;ll sign up and be auto-assigned to the owning CA.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Owner CA</th>
            <th>Status</th>
            <th>Invited</th>
            <th>Expires</th>
            <th style={{ textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isAccepted = r.status === "ACCEPTED";
            const isClosed = isAccepted || r.status === "REVOKED";
            const busy = busyId === r.id;
            return (
              <tr key={r.id}>
                <td>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{r.name ?? r.email}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {r.email}
                    {r.company ? ` · ${r.company}` : ""}
                  </p>
                </td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.assignedCaName ?? "—"}</td>
                <td><StatusBadge status={r.status} /></td>
                <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{format(new Date(r.createdAt), "dd MMM yyyy")}</td>
                <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {isAccepted ? "—" : format(new Date(r.expiresAt), "dd MMM yyyy")}
                </td>
                <td style={{ textAlign: "right" }}>
                  {!isClosed ? (
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <button className="btn-ghost" disabled={busy} onClick={() => onResend(r.id)} style={{ fontSize: 12, padding: "5px 10px" }}>
                        <RefreshCw size={12} /> Resend
                      </button>
                      <button
                        className="btn-ghost"
                        disabled={busy}
                        onClick={() => onCancel(r.id)}
                        style={{ fontSize: 12, padding: "5px 10px", color: "#ef4444" }}
                      >
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
  );
}

// ---------------------------------------------------------------------------
// CA / team invitations table
// ---------------------------------------------------------------------------
function TeamTable({
  rows,
  busyId,
  onResend,
  onRevoke,
}: {
  rows: CaInviteRow[];
  busyId: string | null;
  onResend: (id: string) => void;
  onRevoke: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="section-card">
        <div className="empty-state">
          <UserPlus size={44} color="var(--text-muted)" />
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>No pending CA invitations</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", maxWidth: 320 }}>
            Invite CAs and team members from the <strong>Team</strong> page.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Role</th>
            <th>Status</th>
            <th>Expires</th>
            <th style={{ textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const busy = busyId === r.id;
            const closed = r.status === "ACCEPTED" || r.status === "REVOKED";
            return (
              <tr key={r.id}>
                <td>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{r.name ?? r.email}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.email}</p>
                </td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.firmRole ?? "—"}</td>
                <td><StatusBadge status={r.status} /></td>
                <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.expiresAt ? format(new Date(r.expiresAt), "dd MMM yyyy") : "—"}</td>
                <td style={{ textAlign: "right" }}>
                  {!closed ? (
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <button className="btn-ghost" disabled={busy} onClick={() => onResend(r.id)} style={{ fontSize: 12, padding: "5px 10px" }}>
                        <RefreshCw size={12} /> Resend
                      </button>
                      <button className="btn-ghost" disabled={busy} onClick={() => onRevoke(r.id)} style={{ fontSize: 12, padding: "5px 10px", color: "#ef4444" }}>
                        <X size={12} /> Revoke
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
  );
}
