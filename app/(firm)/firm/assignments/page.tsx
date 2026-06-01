"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { UserPlus, Users, RefreshCcw, Trash2, X, CheckCircle2 } from "lucide-react";

interface Assignment {
  id: string;
  customerId: string;
  caId: string;
  isActive: boolean;
  createdAt: string;
  customer: { id: string; name: string; email: string | null; company: string | null };
  ca: { id: string; name: string | null; email: string };
  assignedBy: { id: string; name: string | null };
  _count?: { firmTasks: number };
}

interface Customer {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  _count: { firmTasks: number; customerAssignments: number };
}

interface CAUser {
  id: string;
  name: string | null;
  email: string;
  _count: { customerAssignments: number };
}

export default function FirmAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [caUsers, setCaUsers] = useState<CAUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ customerId: "", caId: "" });
  const [successMsg, setSuccessMsg] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [assignRes, custRes] = await Promise.all([
        fetch("/api/firm/assignments"),
        fetch("/api/firm/customers?withCA=true"),
      ]);
      const assignData = await assignRes.json();
      const custData = await custRes.json();
      setAssignments(assignData.assignments ?? []);
      setCustomers(custData.customers ?? []);
      setCaUsers(custData.caUsers ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId || !form.caId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/firm/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ customerId: "", caId: "" });
        setSuccessMsg("Customer assigned successfully!");
        setTimeout(() => setSuccessMsg(""), 3000);
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await fetch(`/api/firm/assignments/${id}`, { method: "DELETE" });
      load();
    } finally {
      setDeleting(null);
    }
  };

  // Group assignments by customer
  const unassignedCustomers = customers.filter(
    (c) => !assignments.some((a) => a.customerId === c.id && a.isActive)
  );

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 className="section-title">Customer Assignments</h1>
          <p className="section-subtitle">
            Assign customers to CA team members
          </p>
        </div>
        <button
          className="btn-brand"
          onClick={() => setShowModal(true)}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <UserPlus size={15} />
          New Assignment
        </button>
      </div>

      {successMsg && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.3)",
            borderRadius: 10,
            marginBottom: 20,
            color: "#10b981",
            fontSize: 13,
          }}
        >
          <CheckCircle2 size={16} />
          {successMsg}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total Assignments", value: assignments.filter((a) => a.isActive).length, color: "#6366f1" },
          { label: "Unassigned Customers", value: unassignedCustomers.length, color: "#f59e0b" },
          { label: "CA Members", value: caUsers.length, color: "#0ea5e9" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="section-card">
          <div className="empty-state">
            <div className="loading-spinner" />
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Loading assignments...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Active Assignments Table */}
          <div className="section-card" style={{ marginBottom: 24, padding: 0, overflow: "hidden" }}>
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Users size={16} color="#6366f1" />
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                Active Assignments
              </h2>
              <span
                style={{
                  marginLeft: "auto",
                  padding: "2px 8px",
                  borderRadius: 99,
                  background: "rgba(99,102,241,0.12)",
                  color: "#6366f1",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {assignments.filter((a) => a.isActive).length}
              </span>
            </div>
            {assignments.filter((a) => a.isActive).length === 0 ? (
              <div className="empty-state" style={{ padding: "32px 24px" }}>
                <UserPlus size={36} color="var(--text-muted)" />
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No assignments yet</p>
                <button className="btn-brand" onClick={() => setShowModal(true)}>
                  Create first assignment
                </button>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Assigned CA</th>
                    <th>Tasks</th>
                    <th>Assigned By</th>
                    <th>Assigned On</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments
                    .filter((a) => a.isActive)
                    .map((a) => (
                      <tr key={a.id}>
                        <td>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                              {a.customer.name}
                            </p>
                            {a.customer.company && (
                              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.customer.company}</p>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                background: "rgba(14,165,233,0.15)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#0ea5e9",
                                flexShrink: 0,
                              }}
                            >
                              {(a.ca.name ?? a.ca.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p style={{ fontSize: 13, color: "var(--text-primary)" }}>{a.ca.name ?? "—"}</p>
                              <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{a.ca.email}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                            {customers.find((c) => c.id === a.customerId)?._count.firmTasks ?? 0}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {a.assignedBy.name ?? "—"}
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {format(new Date(a.createdAt), "dd MMM yyyy")}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => {
                                setForm({ customerId: a.customerId, caId: "" });
                                setShowModal(true);
                              }}
                              title="Reassign"
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "var(--text-secondary)",
                                display: "flex",
                                alignItems: "center",
                                padding: "4px",
                                borderRadius: 6,
                              }}
                            >
                              <RefreshCcw size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(a.id)}
                              disabled={deleting === a.id}
                              title="Remove assignment"
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "#ef4444",
                                display: "flex",
                                alignItems: "center",
                                padding: "4px",
                                borderRadius: 6,
                                opacity: deleting === a.id ? 0.5 : 1,
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Unassigned Customers */}
          {unassignedCustomers.length > 0 && (
            <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <UserPlus size={16} color="#f59e0b" />
                <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                  Unassigned Customers
                </h2>
                <span
                  style={{
                    marginLeft: "auto",
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: "rgba(245,158,11,0.12)",
                    color: "#f59e0b",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {unassignedCustomers.length}
                </span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Tasks</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {unassignedCustomers.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</p>
                        {c.company && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.company}</p>}
                      </td>
                      <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{c._count.firmTasks}</td>
                      <td>
                        <button
                          className="btn-brand"
                          style={{ fontSize: 12, padding: "6px 12px" }}
                          onClick={() => {
                            setForm({ customerId: c.id, caId: "" });
                            setShowModal(true);
                          }}
                        >
                          Assign CA
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Assignment Modal */}
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
          onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); setForm({ customerId: "", caId: "" }); } }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 28,
              width: "100%",
              maxWidth: 440,
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>
                {form.customerId ? "Assign CA" : "New Assignment"}
              </h2>
              <button
                onClick={() => { setShowModal(false); setForm({ customerId: "", caId: "" }); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssign} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                  Customer *
                </label>
                <select
                  required
                  value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value })}
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
                  <option value="">Select customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.company ? ` — ${c.company}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                  Assign to CA *
                </label>
                <select
                  required
                  value={form.caId}
                  onChange={(e) => setForm({ ...form, caId: e.target.value })}
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
                  <option value="">Select CA...</option>
                  {caUsers.map((ca) => (
                    <option key={ca.id} value={ca.id}>
                      {ca.name ?? ca.email} ({ca._count.customerAssignments} customers)
                    </option>
                  ))}
                </select>
                {caUsers.length === 0 && (
                  <p style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>
                    No CA users found. Add CA users to your firm first.
                  </p>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setForm({ customerId: "", caId: "" }); }}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-brand" disabled={saving || caUsers.length === 0}>
                  {saving ? "Assigning..." : "Save Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
