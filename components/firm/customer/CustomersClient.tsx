"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, Plus, Search, Eye, UserPlus, Pencil, Archive, X } from "lucide-react";

export interface CustomerRow {
  id: string;
  name: string;
  company: string | null;
  gstin: string | null;
  email: string | null;
  phone: string | null;
  customerType: string;
  isActive: boolean;
  createdAt: string;
  assignedCaId: string | null;
  assignedCaName: string | null;
  openTasks: number;
}

export interface CaOption {
  id: string;
  name: string;
}

type Filter = "ALL" | "ASSIGNED" | "UNASSIGNED" | "ACTIVE" | "INACTIVE";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ASSIGNED", label: "Assigned" },
  { key: "UNASSIGNED", label: "Unassigned" },
  { key: "ACTIVE", label: "Active" },
  { key: "INACTIVE", label: "Inactive" },
];

export function CustomersClient({ rows, cas }: { rows: CustomerRow[]; cas: CaOption[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomerRow | null>(null);
  const [assignTarget, setAssignTarget] = useState<CustomerRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((c) => {
      if (filter === "ASSIGNED" && !c.assignedCaId) return false;
      if (filter === "UNASSIGNED" && c.assignedCaId) return false;
      if (filter === "ACTIVE" && !c.isActive) return false;
      if (filter === "INACTIVE" && c.isActive) return false;
      if (q) {
        const hay = `${c.name} ${c.company ?? ""} ${c.email ?? ""} ${c.gstin ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, filter]);

  async function archive(c: CustomerRow) {
    if (!confirm(`Archive ${c.name}? They'll be removed from your active customer list.`)) return;
    try {
      const res = await fetch(`/api/firm/customers/${c.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed");
      toast.success("Customer archived");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to archive");
    }
  }

  const counts = {
    total: rows.length,
    assigned: rows.filter((c) => c.assignedCaId).length,
    unassigned: rows.filter((c) => !c.assignedCaId).length,
  };

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h1 className="section-title">Customers</h1>
          <p className="section-subtitle">
            {counts.total} total · {counts.assigned} assigned · {counts.unassigned} unassigned
          </p>
        </div>
        <button onClick={() => setAddOpen(true)} style={primaryBtn}>
          <Plus size={15} /> Add Customer
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, business, GST or email…"
            style={{ width: "100%", padding: "9px 12px 9px 36px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13 }}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                border: `1px solid ${filter === f.key ? "#6366f1" : "var(--border)"}`,
                background: filter === f.key ? "rgba(99,102,241,0.1)" : "var(--bg-elevated)",
                color: filter === f.key ? "#6366f1" : "var(--text-secondary)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <Users size={46} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
              {rows.length === 0 ? "No customers yet" : "No customers match your filters"}
            </p>
            {rows.length === 0 && <button onClick={() => setAddOpen(true)} style={primaryBtn}>Add your first customer</button>}
          </div>
        </div>
      ) : (
        <div className="section-card" style={{ padding: 0, overflow: "auto" }}>
          <table className="data-table" style={{ minWidth: 880 }}>
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Business Name</th>
                <th>GST Number</th>
                <th>Assigned CA</th>
                <th>Open Tasks</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} style={{ opacity: c.isActive ? 1 : 0.6 }}>
                  <td>
                    <Link href={`/firm/customers/${c.id}`} style={{ fontWeight: 600, color: "var(--brand-400)", textDecoration: "none" }}>
                      {c.name}
                    </Link>
                  </td>
                  <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{c.company ?? "—"}</td>
                  <td style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: "var(--font-mono, monospace)" }}>{c.gstin ?? "—"}</td>
                  <td>
                    {c.assignedCaName ? (
                      <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{c.assignedCaName}</span>
                    ) : (
                      <span className="badge" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", borderColor: "rgba(245,158,11,0.3)" }}>Unassigned</span>
                    )}
                  </td>
                  <td style={{ fontWeight: 600, color: c.openTasks > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>{c.openTasks}</td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.isActive ? "#10b981" : "#ef4444" }} />
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <Link href={`/firm/customers/${c.id}`} title="View" style={iconBtnStyle()}><Eye size={14} /></Link>
                      <button onClick={() => setAssignTarget(c)} title="Assign" style={iconBtnStyle()}><UserPlus size={14} /></button>
                      <button onClick={() => setEditTarget(c)} title="Edit" style={iconBtnStyle()}><Pencil size={14} /></button>
                      <button onClick={() => archive(c)} title="Archive" style={iconBtnStyle(true)}><Archive size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && <CustomerFormModal onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); router.refresh(); }} />}
      {editTarget && <CustomerFormModal customer={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); router.refresh(); }} />}
      {assignTarget && <AssignModal customer={assignTarget} cas={cas} onClose={() => setAssignTarget(null)} onSaved={() => { setAssignTarget(null); router.refresh(); }} />}
    </div>
  );
}

function CustomerFormModal({
  customer,
  onClose,
  onSaved,
}: {
  customer?: CustomerRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!customer;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: customer?.name ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    company: customer?.company ?? "",
    gstin: customer?.gstin ?? "",
    customerType: customer?.customerType ?? "BUSINESS",
    isActive: customer?.isActive ?? true,
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/firm/customers/${customer!.id}` : "/api/firm/customers", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed");
      toast.success(isEdit ? "Customer updated" : "Customer added");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <Modal title={isEdit ? "Edit Customer" : "Add Customer"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Name" required><input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Customer / business name" style={inp} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Email"><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@example.com" style={inp} /></Field>
          <Field label="Phone"><input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="9999999999" style={inp} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Business Name"><input value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="ABC Pvt Ltd" style={inp} /></Field>
          <Field label="GST Number"><input value={form.gstin} onChange={(e) => set("gstin", e.target.value)} placeholder="22AAAAA0000A1Z5" style={inp} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Type">
            <select value={form.customerType} onChange={(e) => set("customerType", e.target.value)} style={inp}>
              <option value="INDIVIDUAL">Individual</option>
              <option value="BUSINESS">Business</option>
              <option value="WHOLESALE">Wholesale</option>
              <option value="RETAIL">Retail</option>
              <option value="GOVERNMENT">Government</option>
            </select>
          </Field>
          {isEdit && (
            <Field label="Status">
              <select value={form.isActive ? "1" : "0"} onChange={(e) => set("isActive", e.target.value === "1")} style={inp}>
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </Field>
          )}
        </div>
      </div>
      <ModalActions onClose={onClose} onSave={save} saving={saving} saveLabel={isEdit ? "Save Changes" : "Add Customer"} />
    </Modal>
  );
}

function AssignModal({
  customer,
  cas,
  onClose,
  onSaved,
}: {
  customer: CustomerRow;
  cas: CaOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [caId, setCaId] = useState(customer.assignedCaId ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!caId) {
      toast.error("Select a CA");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/firm/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: customer.id, caId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed");
      toast.success(`${customer.name} assigned`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to assign");
      setSaving(false);
    }
  }

  return (
    <Modal title={`Assign ${customer.name}`} onClose={onClose}>
      <Field label="Assign to CA" required>
        <select value={caId} onChange={(e) => setCaId(e.target.value)} style={inp}>
          <option value="">Select a CA…</option>
          {cas.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Field>
      {customer.assignedCaName && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
          Currently assigned to <strong>{customer.assignedCaName}</strong>. Reassigning moves the relationship.
        </p>
      )}
      <ModalActions onClose={onClose} onSave={save} saving={saving} saveLabel="Assign" />
    </Modal>
  );
}

// ── shared UI ───────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="section-card" style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onClose, onSave, saving, saveLabel }: { onClose: () => void; onSave: () => void; saving: boolean; saveLabel: string }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 22 }}>
      <button onClick={onClose} style={{ ...secondaryBtn, flex: 1 }}>Cancel</button>
      <button onClick={onSave} disabled={saving} style={{ ...primaryBtn, flex: 1, justifyContent: "center", opacity: saving ? 0.6 : 1 }}>
        {saving ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
        {label}{required && <span style={{ color: "#ef4444" }}> *</span>}
      </span>
      {children}
    </label>
  );
}

function iconBtnStyle(danger?: boolean): React.CSSProperties {
  return {
    width: 30,
    height: 30,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 7,
    cursor: "pointer",
    color: danger ? "#ef4444" : "var(--text-secondary)",
  };
}

const inp: React.CSSProperties = {
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
