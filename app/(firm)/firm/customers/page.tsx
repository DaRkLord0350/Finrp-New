"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Users, Plus, Search, Mail, Phone, X } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  customerType: string;
  isActive: boolean;
  createdAt: string;
  _count: { firmTasks: number; customerAssignments: number };
}

export default function FirmCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    customerType: "BUSINESS",
  });

  const load = () => {
    setLoading(true);
    fetch("/api/firm/customers")
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.company ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/firm/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ name: "", email: "", phone: "", company: "", customerType: "BUSINESS" });
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  const typeColor: Record<string, string> = {
    INDIVIDUAL: "#6366f1",
    BUSINESS: "#0ea5e9",
    WHOLESALE: "#10b981",
    RETAIL: "#f59e0b",
    GOVERNMENT: "#8b5cf6",
  };

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 className="section-title">Customers</h1>
          <p className="section-subtitle">{customers.length} customer{customers.length !== 1 ? "s" : ""} in your firm</p>
        </div>
        <button
          className="btn-brand"
          onClick={() => setShowModal(true)}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <Plus size={15} />
          Add Customer
        </button>
      </div>

      {/* Search */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          marginBottom: 20,
        }}
      >
        <Search size={14} color="var(--text-muted)" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers by name, email, company..."
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 13,
            color: "var(--text-primary)",
          }}
        />
        {search && (
          <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <X size={14} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="section-card">
          <div className="empty-state">
            <div className="loading-spinner" />
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Loading customers...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <Users size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
              {search ? "No customers match your search" : "No customers yet"}
            </p>
            {!search && (
              <button className="btn-brand" onClick={() => setShowModal(true)}>
                Add your first customer
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Type</th>
                <th>Contact</th>
                <th>Tasks</th>
                <th>CA Assigned</th>
                <th>Status</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</p>
                      {c.company && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.company}</p>}
                    </div>
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: `${typeColor[c.customerType] ?? "#94a3b8"}18`,
                        color: typeColor[c.customerType] ?? "#94a3b8",
                        borderColor: `${typeColor[c.customerType] ?? "#94a3b8"}30`,
                      }}
                    >
                      {c.customerType}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: 12 }}>
                      {c.email && (
                        <p style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-secondary)" }}>
                          <Mail size={10} /> {c.email}
                        </p>
                      )}
                      {c.phone && (
                        <p style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-muted)" }}>
                          <Phone size={10} /> {c.phone}
                        </p>
                      )}
                      {!c.email && !c.phone && <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </div>
                  </td>
                  <td style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    {c._count.firmTasks}
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: c._count.customerAssignments > 0 ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
                        color: c._count.customerAssignments > 0 ? "#10b981" : "#f59e0b",
                        borderColor: c._count.customerAssignments > 0 ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)",
                      }}
                    >
                      {c._count.customerAssignments > 0 ? "Assigned" : "Unassigned"}
                    </span>
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: c.isActive ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                        color: c.isActive ? "#10b981" : "#ef4444",
                        borderColor: c.isActive ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)",
                      }}
                    >
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {format(new Date(c.createdAt), "dd MMM yyyy")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Customer Modal */}
      {showModal && (
        <div
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
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 28,
              width: "100%",
              maxWidth: 480,
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>Add Customer</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                  Name *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Customer / business name"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@example.com"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 13,
                      color: "var(--text-primary)",
                      outline: "none",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 13,
                      color: "var(--text-primary)",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Company</label>
                <input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Company name"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Customer Type</label>
                <select
                  value={form.customerType}
                  onChange={(e) => setForm({ ...form, customerType: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "var(--text-primary)",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="BUSINESS">Business</option>
                  <option value="WHOLESALE">Wholesale</option>
                  <option value="RETAIL">Retail</option>
                  <option value="GOVERNMENT">Government</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-brand" disabled={saving}>
                  {saving ? "Adding..." : "Add Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
