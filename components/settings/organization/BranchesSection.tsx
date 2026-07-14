"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GitBranch, Plus, Trash2, Star, X } from "lucide-react";
import { toast } from "sonner";

export interface OrgBranch {
  id: string;
  name: string;
  branchCode?: string | null;
  gstin?: string | null;
  city?: string | null;
  state?: string | null;
  isHeadOffice: boolean;
  isActive: boolean;
}

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

export default function BranchesSection({ initialBranches }: { initialBranches: OrgBranch[] }) {
  const [branches, setBranches] = useState<OrgBranch[]>(initialBranches);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", branchCode: "", gstin: "", city: "", state: "", isHeadOffice: false });

  async function handleAdd() {
    if (!form.name.trim()) {
      toast.error("Branch name is required");
      return;
    }
    try {
      setSaving(true);
      const res = await fetch("/api/settings/organization/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to add branch");
      const branch = await res.json();
      setBranches((prev) =>
        form.isHeadOffice ? [...prev.map((b) => ({ ...b, isHeadOffice: false })), branch] : [...prev, branch]
      );
      setForm({ name: "", branchCode: "", gstin: "", city: "", state: "", isHeadOffice: false });
      setShowForm(false);
      toast.success("Branch added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add branch");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const prev = branches;
    setBranches((b) => b.filter((x) => x.id !== id));
    try {
      const res = await fetch(`/api/settings/organization/branches/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove branch");
      toast.success("Branch removed");
    } catch (e) {
      setBranches(prev);
      toast.error(e instanceof Error ? e.message : "Failed to remove branch");
    }
  }

  async function handleSetHeadOffice(id: string) {
    const prev = branches;
    setBranches((bs) => bs.map((b) => ({ ...b, isHeadOffice: b.id === id })));
    try {
      const res = await fetch(`/api/settings/organization/branches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHeadOffice: true }),
      });
      if (!res.ok) throw new Error("Failed to update head office");
    } catch (e) {
      setBranches(prev);
      toast.error(e instanceof Error ? e.message : "Failed to update head office");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.32 }}
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, marginBottom: 20 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
          <span style={{ color: "#6366f1" }}><GitBranch size={16} /></span>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Branches</h2>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", cursor: "pointer" }}
        >
          {showForm ? <X size={13} /> : <Plus size={13} />}
          {showForm ? "Cancel" : "Add Branch"}
        </button>
      </div>

      {showForm && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16, padding: 16, background: "var(--bg-elevated)", borderRadius: 10 }}>
          <input placeholder="Branch name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
          <input placeholder="Branch code" value={form.branchCode} onChange={(e) => setForm({ ...form, branchCode: e.target.value })} style={inputStyle} />
          <input placeholder="GSTIN (if state-specific)" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} style={inputStyle} maxLength={15} />
          <input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={inputStyle} />
          <input placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} style={inputStyle} />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={form.isHeadOffice} onChange={(e) => setForm({ ...form, isHeadOffice: e.target.checked })} />
            Set as head office
          </label>
          <div style={{ gridColumn: "1 / -1" }}>
            <button
              onClick={handleAdd}
              disabled={saving}
              style={{ padding: "9px 18px", background: "#6366f1", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}
            >
              {saving ? "Saving…" : "Save Branch"}
            </button>
          </div>
        </div>
      )}

      {branches.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No branches added yet. Head office is implied by the organization&apos;s registered address.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {branches.map((b) => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "var(--bg-elevated)", borderRadius: 10, border: "1px solid var(--border)" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                  {b.name}
                  {b.isHeadOffice && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#f59e0b20", color: "#f59e0b" }}>
                      HEAD OFFICE
                    </span>
                  )}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {[b.branchCode, b.city, b.state, b.gstin].filter(Boolean).join(" · ") || "No additional details"}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {!b.isHeadOffice && (
                  <button
                    title="Set as head office"
                    onClick={() => handleSetHeadOffice(b.id)}
                    style={{ padding: 6, background: "transparent", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--text-muted)" }}
                  >
                    <Star size={13} />
                  </button>
                )}
                <button
                  title="Remove"
                  onClick={() => handleDelete(b.id)}
                  style={{ padding: 6, background: "transparent", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "#ef4444" }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
