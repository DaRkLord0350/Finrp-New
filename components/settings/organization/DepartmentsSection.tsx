"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Network, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export interface OrgDepartment {
  id: string;
  name: string;
  headUserId?: string | null;
  parentDepartmentId?: string | null;
  isActive: boolean;
  headUser?: { id: string; name: string | null; email: string } | null;
}

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
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

export default function DepartmentsSection({ initialDepartments }: { initialDepartments: OrgDepartment[] }) {
  const [departments, setDepartments] = useState<OrgDepartment[]>(initialDepartments);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", headUserId: "", parentDepartmentId: "" });

  useEffect(() => {
    fetch("/api/settings/users")
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((data) => setMembers(data.members ?? []))
      .catch(() => setMembers([]));
  }, []);

  async function handleAdd() {
    if (!form.name.trim()) {
      toast.error("Department name is required");
      return;
    }
    try {
      setSaving(true);
      const res = await fetch("/api/settings/organization/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          headUserId: form.headUserId || null,
          parentDepartmentId: form.parentDepartmentId || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to add department");
      const department = await res.json();
      setDepartments((prev) => [...prev, department]);
      setForm({ name: "", headUserId: "", parentDepartmentId: "" });
      setShowForm(false);
      toast.success("Department added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add department");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const prev = departments;
    setDepartments((d) => d.filter((x) => x.id !== id));
    try {
      const res = await fetch(`/api/settings/organization/departments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove department");
      toast.success("Department removed");
    } catch (e) {
      setDepartments(prev);
      toast.error(e instanceof Error ? e.message : "Failed to remove department");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.34 }}
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, marginBottom: 20 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
          <span style={{ color: "#6366f1" }}><Network size={16} /></span>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Departments</h2>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", cursor: "pointer" }}
        >
          {showForm ? <X size={13} /> : <Plus size={13} />}
          {showForm ? "Cancel" : "Add Department"}
        </button>
      </div>

      {showForm && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16, padding: 16, background: "var(--bg-elevated)", borderRadius: 10 }}>
          <input placeholder="Department name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
          <select value={form.headUserId} onChange={(e) => setForm({ ...form, headUserId: e.target.value })} style={inputStyle}>
            <option value="">No department head</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name ?? m.email}</option>
            ))}
          </select>
          <select value={form.parentDepartmentId} onChange={(e) => setForm({ ...form, parentDepartmentId: e.target.value })} style={inputStyle}>
            <option value="">No parent department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <div style={{ gridColumn: "1 / -1" }}>
            <button
              onClick={handleAdd}
              disabled={saving}
              style={{ padding: "9px 18px", background: "#6366f1", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}
            >
              {saving ? "Saving…" : "Save Department"}
            </button>
          </div>
        </div>
      )}

      {departments.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No departments added yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {departments.map((d) => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "var(--bg-elevated)", borderRadius: 10, border: "1px solid var(--border)" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{d.name}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {d.headUser ? `Head: ${d.headUser.name ?? d.headUser.email}` : "No department head assigned"}
                  {d.parentDepartmentId && ` · Reports into ${departments.find((p) => p.id === d.parentDepartmentId)?.name ?? "another department"}`}
                </p>
              </div>
              <button
                title="Remove"
                onClick={() => handleDelete(d.id)}
                style={{ padding: 6, background: "transparent", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "#ef4444" }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
