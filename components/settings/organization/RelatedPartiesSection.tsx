"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Plus, Trash2, X, ShieldCheck, Star } from "lucide-react";
import { toast } from "sonner";

export interface RelatedParty {
  id: string;
  roles: string[];
  name: string;
  email?: string | null;
  phone?: string | null;
  pan?: string | null;
  din?: string | null;
  designation?: string | null;
  shareholdingPercent?: string | number | null;
  isPrimarySignatory: boolean;
  verificationStatus: string;
}

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "DIRECTOR", label: "Director" },
  { value: "PARTNER", label: "Partner" },
  { value: "PROPRIETOR", label: "Proprietor" },
  { value: "LLP_MEMBER", label: "LLP Member" },
  { value: "BENEFICIAL_OWNER", label: "Beneficial Owner" },
  { value: "AUTHORIZED_SIGNATORY", label: "Authorized Signatory" },
  { value: "AUTHORIZED_CONTACT", label: "Authorized Contact" },
];

const VERIFICATION_STYLES: Record<string, { bg: string; color: string; text: string }> = {
  VERIFIED: { bg: "#10b98120", color: "#10b981", text: "Verified" },
  FAILED: { bg: "#ef444420", color: "#ef4444", text: "Failed" },
  PENDING: { bg: "#f59e0b20", color: "#f59e0b", text: "Pending" },
  IN_PROGRESS: { bg: "#f59e0b20", color: "#f59e0b", text: "In Progress" },
  EXPIRED: { bg: "#6b728020", color: "#6b7280", text: "Expired" },
  NOT_STARTED: { bg: "#6b728020", color: "#6b7280", text: "Not Verified" },
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--bg-base)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 14,
  color: "var(--text-primary)",
  outline: "none",
  boxSizing: "border-box",
};

const emptyForm = { roles: [] as string[], name: "", email: "", phone: "", pan: "", din: "", designation: "", isPrimarySignatory: false };

export default function RelatedPartiesSection({ initialParties }: { initialParties: RelatedParty[] }) {
  const [parties, setParties] = useState<RelatedParty[]>(initialParties);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  function toggleRole(role: string) {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role],
    }));
  }

  async function handleAdd() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (form.roles.length === 0) {
      toast.error("Select at least one role");
      return;
    }
    try {
      setSaving(true);
      const res = await fetch("/api/settings/organization/related-parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to add");
      const party = await res.json();
      setParties((prev) => {
        const existingIdx = prev.findIndex((p) => p.id === party.id);
        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = party;
          return next;
        }
        return [...prev, party];
      });
      setForm(emptyForm);
      setShowForm(false);
      toast.success("Saved — if this PAN already existed, the role was added to that person instead of a duplicate");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const prev = parties;
    setParties((p) => p.filter((x) => x.id !== id));
    try {
      const res = await fetch(`/api/settings/organization/related-parties/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove");
      toast.success("Removed");
    } catch (e) {
      setParties(prev);
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    }
  }

  async function handleVerify(id: string) {
    try {
      setVerifyingId(id);
      const res = await fetch(`/api/settings/organization/related-parties/${id}/verify`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error || "Verification failed");
      const updated = await res.json();
      setParties((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
      toast.success(`PAN verification: ${updated.verificationStatus}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifyingId(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.36 }}
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, marginBottom: 20 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
          <span style={{ color: "#6366f1" }}><Users size={16} /></span>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Signatories, Directors & Beneficial Owners</h2>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", cursor: "pointer" }}
        >
          {showForm ? <X size={13} /> : <Plus size={13} />}
          {showForm ? "Cancel" : "Add Person"}
        </button>
      </div>

      {showForm && (
        <div style={{ marginBottom: 16, padding: 16, background: "var(--bg-elevated)", borderRadius: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 8 }}>
            Roles (a person can hold more than one — e.g. Director + Authorized Signatory)
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {ROLE_OPTIONS.map((r) => (
              <label
                key={r.value}
                style={{
                  display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 10px",
                  borderRadius: 8, cursor: "pointer",
                  background: form.roles.includes(r.value) ? "#6366f120" : "var(--bg-base)",
                  border: `1px solid ${form.roles.includes(r.value) ? "#6366f1" : "var(--border)"}`,
                  color: form.roles.includes(r.value) ? "#6366f1" : "var(--text-secondary)",
                }}
              >
                <input type="checkbox" checked={form.roles.includes(r.value)} onChange={() => toggleRole(r.value)} style={{ display: "none" }} />
                {r.label}
              </label>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input placeholder="Full name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            <input placeholder="Designation (e.g. Managing Director)" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} style={inputStyle} />
            <input placeholder="PAN" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} maxLength={10} style={inputStyle} />
            <input placeholder="DIN (directors only)" value={form.din} onChange={(e) => setForm({ ...form, din: e.target.value })} style={inputStyle} />
            <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={form.isPrimarySignatory} onChange={(e) => setForm({ ...form, isPrimarySignatory: e.target.checked })} />
              Primary signatory (vs. secondary)
            </label>
          </div>
          <button
            onClick={handleAdd}
            disabled={saving}
            style={{ marginTop: 14, padding: "9px 18px", background: "#6366f1", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}
          >
            {saving ? "Saving…" : "Save Person"}
          </button>
        </div>
      )}

      {parties.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No signatories, directors, or beneficial owners added yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {parties.map((p) => {
            const vStyle = VERIFICATION_STYLES[p.verificationStatus] ?? VERIFICATION_STYLES.NOT_STARTED;
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "var(--bg-elevated)", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                    {p.name}
                    {p.isPrimarySignatory && (
                      <span title="Primary signatory"><Star size={12} color="#f59e0b" /></span>
                    )}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {p.roles.map((r) => ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r).join(" · ")}
                    {p.pan && ` · PAN ${p.pan}`}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: vStyle.bg, color: vStyle.color }}>
                    {vStyle.text}
                  </span>
                  {p.pan && p.verificationStatus !== "VERIFIED" && (
                    <button
                      title="Verify PAN via TBX"
                      onClick={() => handleVerify(p.id)}
                      disabled={verifyingId === p.id}
                      style={{ padding: 6, background: "transparent", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--text-muted)" }}
                    >
                      <ShieldCheck size={13} />
                    </button>
                  )}
                  <button
                    title="Remove"
                    onClick={() => handleDelete(p.id)}
                    style={{ padding: 6, background: "transparent", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "#ef4444" }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
