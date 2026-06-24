"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCircle, Check, Loader2 } from "lucide-react";

const SPECIALIZATIONS = ["", "GST", "INCOME_TAX", "AUDIT", "ROC", "ACCOUNTING", "PAYROLL"];

interface Initial {
  name: string;
  phone: string;
  designation: string;
  specialization: string;
}

export default function ProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/ca/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || null,
          designation: form.designation || null,
          specialization: form.specialization || null,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? "Save failed");
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="section-card">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <UserCircle size={18} color="#6366f1" />
        </div>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>My Details</h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Full Name">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="pf-input" />
        </Field>
        <Field label="Phone">
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="pf-input" placeholder="+91…" />
        </Field>
        <Field label="Designation">
          <input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} className="pf-input" placeholder="e.g. Senior Associate" />
        </Field>
        <Field label="Specialization">
          <select value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} className="pf-input" style={{ cursor: "pointer" }}>
            {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s === "" ? "— None —" : s.replace("_", " ")}</option>)}
          </select>
        </Field>
      </div>

      {error && <p style={{ fontSize: 12, color: "#ef4444", marginTop: 12 }}>{error}</p>}
      <button
        onClick={save}
        disabled={saving || !dirty || !form.name.trim()}
        style={{ marginTop: 18, display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 8, border: "none", background: dirty ? "linear-gradient(135deg,#6366f1,#0ea5e9)" : "var(--border)", color: dirty ? "#fff" : "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: dirty && !saving ? "pointer" : "default", opacity: saving ? 0.7 : 1 }}
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
        {saved ? "Saved" : "Save Changes"}
      </button>

      <style>{`.pf-input { width: 100%; padding: 9px 11px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 13px; outline: none; }`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}
