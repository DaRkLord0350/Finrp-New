"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Rocket, UserCheck, Users, Send, X, RefreshCw, MailCheck, AlertTriangle, Clock } from "lucide-react";
import {
  CA_STAGE_LABELS,
  CA_STAGE_COLORS,
  CUSTOMER_STAGE_LABELS,
  CUSTOMER_STAGE_COLORS,
  type CaStage,
  type CustomerStage,
} from "@/lib/firm/onboarding";
import { FIRM_ROLE_LABELS } from "@/lib/team/constants";
import type { FirmMemberRole } from "@prisma/client";

export interface CaOnboardingRow {
  id: string;
  name: string;
  email: string;
  firmRole: string | null;
  invitationDate: string;
  stage: CaStage;
  progress: number;
  managerName: string | null;
  lastActivity: string | null;
  inviteStatus: string;
  emailSentAt: string | null;
  emailError: string | null;
  accepted: boolean;
}

export interface CustomerOnboardingRow {
  id: string;
  customerName: string;
  businessName: string | null;
  inviteDate: string;
  assignedCaName: string | null;
  stage: CustomerStage;
  progress: number;
}

export interface CaOption {
  id: string;
  name: string;
}

type Tab = "ca" | "customer";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function OnboardingClient({
  caRows,
  customerRows,
  cas,
}: {
  caRows: CaOnboardingRow[];
  customerRows: CustomerOnboardingRow[];
  cas: CaOption[];
}) {
  const [tab, setTab] = useState<Tab>("ca");
  const [inviteOpen, setInviteOpen] = useState(false);

  const caActive = caRows.filter((r) => r.stage === "ACTIVE").length;
  const custCompleted = customerRows.filter((r) => r.stage === "COMPLETED").length;

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h1 className="section-title">Onboarding</h1>
          <p className="section-subtitle">Track CA and customer onboarding from invite to active.</p>
        </div>
        {tab === "customer" && (
          <button onClick={() => setInviteOpen(true)} style={primaryBtn}>
            <Send size={14} /> Invite Customer
          </button>
        )}
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 24 }}>
        <SummaryCard icon={<Rocket size={18} />} color="#6366f1" value={caRows.length} label="CA Invitations" />
        <SummaryCard icon={<UserCheck size={18} />} color="#10b981" value={caActive} label="CAs Active" />
        <SummaryCard icon={<Users size={18} />} color="#0ea5e9" value={customerRows.length} label="Customer Invites" />
        <SummaryCard icon={<UserCheck size={18} />} color="#8b5cf6" value={custCompleted} label="Customers Onboarded" />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {([
          ["ca", `CA Onboarding (${caRows.length})`],
          ["customer", `Customer Onboarding (${customerRows.length})`],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{ padding: "10px 14px", background: "transparent", border: "none", borderBottom: `2px solid ${tab === key ? "#6366f1" : "transparent"}`, color: tab === key ? "var(--text-primary)" : "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: -1 }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* CA Onboarding */}
      {tab === "ca" && (
        caRows.length === 0 ? (
          <Empty icon={<Rocket size={46} color="var(--text-muted)" />} title="No CA onboardings yet" body="Use Add CA to invite a team member — they'll appear here as they progress." />
        ) : (
          <div className="section-card" style={{ padding: 0, overflow: "auto" }}>
            <table className="data-table" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Invitation Date</th>
                  <th style={{ minWidth: 200 }}>Status</th>
                  <th>Email</th>
                  <th>Assigned Manager</th>
                  <th>Last Activity</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {caRows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.name}</div>
                      {r.firmRole && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {FIRM_ROLE_LABELS[r.firmRole as FirmMemberRole] ?? r.firmRole}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{r.email}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{fmtDate(r.invitationDate)}</td>
                    <td>
                      <StageCell label={CA_STAGE_LABELS[r.stage]} color={CA_STAGE_COLORS[r.stage]} progress={r.progress} />
                    </td>
                    <td><EmailStatusCell row={r} /></td>
                    <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{r.managerName ?? "—"}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{fmtDate(r.lastActivity)}</td>
                    <td style={{ textAlign: "right" }}><ResendButton row={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Customer Onboarding */}
      {tab === "customer" && (
        customerRows.length === 0 ? (
          <Empty icon={<Users size={46} color="var(--text-muted)" />} title="No customer onboardings yet" body="Invite a customer to start tracking their onboarding journey." />
        ) : (
          <div className="section-card" style={{ padding: 0, overflow: "auto" }}>
            <table className="data-table" style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Business Name</th>
                  <th>Invite Date</th>
                  <th>Assigned CA</th>
                  <th style={{ minWidth: 220 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {customerRows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.customerName}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{r.businessName ?? "—"}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{fmtDate(r.inviteDate)}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{r.assignedCaName ?? "Unassigned"}</td>
                    <td>
                      <StageCell label={CUSTOMER_STAGE_LABELS[r.stage]} color={CUSTOMER_STAGE_COLORS[r.stage]} progress={r.progress} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {inviteOpen && <InviteCustomerModal cas={cas} onClose={() => setInviteOpen(false)} />}
    </div>
  );
}

function StageCell({ label, color, progress }: { label: string; color: string; progress: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span className="badge" style={{ background: `${color}18`, color, borderColor: `${color}30`, width: "fit-content" }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 5, borderRadius: 99, background: "var(--bg-elevated)", overflow: "hidden", minWidth: 80 }}>
          <div style={{ width: `${progress}%`, height: "100%", background: color, borderRadius: 99 }} />
        </div>
        <span style={{ fontSize: 11, color: "var(--text-muted)", width: 32, textAlign: "right" }}>{progress}%</span>
      </div>
    </div>
  );
}

function EmailStatusCell({ row }: { row: CaOnboardingRow }) {
  if (row.emailError) {
    return (
      <span
        title={row.emailError}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#ef4444", cursor: "help" }}
      >
        <AlertTriangle size={13} /> Failed
      </span>
    );
  }
  if (row.emailSentAt || row.inviteStatus === "SENT") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#10b981" }}>
        <MailCheck size={13} /> {row.emailSentAt ? `Sent ${fmtDate(row.emailSentAt)}` : "Sent"}
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-muted)" }}>
      <Clock size={13} /> Not sent
    </span>
  );
}

function ResendButton({ row }: { row: CaOnboardingRow }) {
  const router = useRouter();
  const [sending, setSending] = useState(false);

  // Accepted invites can't be resent (the seat is already claimed).
  if (row.accepted || row.inviteStatus === "ACCEPTED") return <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>;

  async function resend() {
    setSending(true);
    try {
      const res = await fetch(`/api/firm/team/invite/${row.id}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.emailSent === false) {
        throw new Error(data.error ?? "Failed to resend invitation");
      }
      toast.success(`Invitation resent to ${row.email}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to resend invitation");
    } finally {
      setSending(false);
    }
  }

  return (
    <button
      onClick={resend}
      disabled={sending}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "6px 10px",
        background: "var(--bg-elevated)",
        color: "var(--text-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 7,
        fontSize: 12,
        fontWeight: 600,
        cursor: sending ? "not-allowed" : "pointer",
        opacity: sending ? 0.6 : 1,
      }}
    >
      <RefreshCw size={12} className={sending ? "animate-spin" : undefined} /> {sending ? "Sending…" : "Resend"}
    </button>
  );
}

function SummaryCard({ icon, color, value, label }: { icon: React.ReactNode; color: string; value: number; label: string }) {
  return (
    <div className="stat-card">
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}1a`, color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
        {icon}
      </div>
      <p style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)" }}>{value}</p>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{label}</p>
    </div>
  );
}

function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="section-card">
      <div className="empty-state">
        {icon}
        <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{title}</p>
        <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 340, textAlign: "center" }}>{body}</p>
      </div>
    </div>
  );
}

function InviteCustomerModal({ cas, onClose }: { cas: CaOption[]; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", assignedCaId: "", message: "" });

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (!form.email.trim()) {
      toast.error("Email is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/ca/customers/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          name: form.name.trim() || null,
          phone: form.phone.trim() || null,
          company: form.company.trim() || null,
          message: form.message.trim() || null,
          assignedCaId: form.assignedCaId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to send invitation");
      toast.success(`Invitation sent to ${form.email.trim()}`);
      onClose();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send invitation");
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="section-card" style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>Invite Customer</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Email" required value={form.email} onChange={(v) => set("email", v)} placeholder="customer@example.com" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Input label="Name" value={form.name} onChange={(v) => set("name", v)} placeholder="Contact name" />
            <Input label="Phone" value={form.phone} onChange={(v) => set("phone", v)} placeholder="9999999999" />
          </div>
          <Input label="Business Name" value={form.company} onChange={(v) => set("company", v)} placeholder="ABC Pvt Ltd" />
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Assign to CA</span>
            <select value={form.assignedCaId} onChange={(e) => set("assignedCaId", e.target.value)} style={modalInput}>
              <option value="">Me (inviter)</option>
              {cas.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 22 }}>
          <button onClick={onClose} style={{ ...secondaryBtn, flex: 1 }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ ...primaryBtn, flex: 1, justifyContent: "center", opacity: saving ? 0.6 : 1 }}>
            <Send size={14} /> {saving ? "Sending…" : "Send Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
        {label}{required && <span style={{ color: "#ef4444" }}> *</span>}
      </span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={modalInput} />
    </label>
  );
}

const modalInput: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  fontSize: 14,
};

const primaryBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 16px",
  background: "#6366f1",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "9px 16px",
  background: "var(--bg-elevated)",
  color: "var(--text-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
