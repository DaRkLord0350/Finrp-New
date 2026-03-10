"use client";

import { useState } from "react";
import { Plus, Search, Mail, Phone, FileText, ArrowRight, MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import CustomerForm from "@/components/CustomerForm";
import type { CreateCustomerInput } from "@/types";
import { useCustomers } from "@/hooks/useCustomers";
import { format } from "date-fns";

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ["#6366f1", "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444"];

export default function CRMPage() {
  const { customers, loading, error, refetch, createCustomer, deleteCustomer } = useCustomers();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.company ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateCustomer = async (data: CreateCustomerInput) => {
    try {
      await createCustomer({
        name: data.name,
        email: data.email ?? undefined,
        phone: data.phone ?? undefined,
        company: data.company ?? undefined,
      });
      setShowForm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create customer");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete customer "${name}"? This is permanent.`)) return;
    try {
      await deleteCustomer(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete customer");
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Customers
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
            {loading ? "Loading…" : `${customers.length} total · Track relationships and invoices`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={refetch} style={{ padding: "8px 12px" }}>
            <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
          </button>
          <button className="btn-brand" onClick={() => setShowForm(true)}>
            <Plus size={15} /> Add Customer
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#ef4444", fontSize: 13, marginBottom: 20 }}>
          {error} — <button onClick={refetch} style={{ color: "#ef4444", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>Retry</button>
        </div>
      )}

      {/* Search */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 380 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Search by name, email, or company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ height: 180, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 8 }}>
            {search ? "No customers match your search" : "No customers yet"}
          </p>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {search ? "Try adjusting your search." : "Add your first customer to get started."}
          </p>
        </div>
      ) : (
        /* Customer Grid */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {filtered.map((customer, i) => (
            <motion.div
              key={customer.id}
              className="surface"
              style={{ padding: 20, cursor: "pointer" }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
              whileHover={{ y: -2 }}
            >
              {/* Customer header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: `${AVATAR_COLORS[i % AVATAR_COLORS.length]}22`,
                    border: `1px solid ${AVATAR_COLORS[i % AVATAR_COLORS.length]}44`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 700, color: AVATAR_COLORS[i % AVATAR_COLORS.length],
                    flexShrink: 0,
                  }}>
                    {getInitials(customer.name)}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>{customer.name}</p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{customer.company || "Individual"}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(customer.id, customer.name)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}
                  title="Delete customer"
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>

              {/* Contact info */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
                {customer.email && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 12 }}>
                    <Mail size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customer.email}</span>
                  </div>
                )}
                {customer.phone && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 12 }}>
                    <Phone size={12} color="var(--text-muted)" />
                    {customer.phone}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div style={{ display: "flex", gap: 0, background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 14, overflow: "hidden" }}>
                {[
                  { label: "Revenue", value: customer.totalRevenue ? `$${(customer.totalRevenue / 1000).toFixed(1)}k` : "$0" },
                  { label: "Invoices", value: (customer._count?.invoices ?? 0).toString() },
                  { label: "Since", value: format(new Date(customer.createdAt), "MMM d") },
                ].map((stat, si) => (
                  <div key={stat.label} style={{ flex: 1, padding: "10px 12px", borderRight: si < 2 ? "1px solid var(--border)" : "none" }}>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{stat.label}</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8 }}>
                <Link href="/billing/new" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 10px", borderRadius: 8, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "#818cf8", fontSize: 12, fontWeight: 500, textDecoration: "none" }}>
                  <FileText size={13} /> Invoice
                </Link>
                <Link href={`/crm/${customer.id}`} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 10px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 500, textDecoration: "none" }}>
                  View <ArrowRight size={12} />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Customer Form Modal */}
      {showForm && (
        <CustomerForm
          onClose={() => setShowForm(false)}
          onSubmit={handleCreateCustomer}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
