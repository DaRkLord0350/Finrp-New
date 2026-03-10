"use client";

import { useState } from "react";
import { Plus, Search, Mail, Phone, FileText, ArrowRight, MoreHorizontal, RefreshCw } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import CustomerForm from "@/components/CustomerForm";
import type { CreateCustomerInput } from "@/types";

const mockCustomers = [
  { id: "1", name: "Acme Corporation", email: "billing@acme.com", phone: "+1 415 555 2671", company: "Acme Corp", invoices: 8, totalRevenue: 42500, createdAt: "Jan 12, 2025" },
  { id: "2", name: "TechFlow Solutions", email: "accounts@techflow.io", phone: "+1 628 555 0101", company: "TechFlow Ltd", invoices: 5, totalRevenue: 18300, createdAt: "Feb 3, 2025" },
  { id: "3", name: "BrightStar Media", email: "hello@brightstar.com", phone: "+1 212 555 8892", company: "BrightStar Inc", invoices: 6, totalRevenue: 31200, createdAt: "Jan 28, 2025" },
  { id: "4", name: "Quantum Ventures", email: "finance@quantumv.com", phone: "+1 310 555 4492", company: "Quantum Media", invoices: 3, totalRevenue: 9800, createdAt: "Mar 1, 2025" },
  { id: "5", name: "NovaBuild Partners", email: "ap@novabuild.co", phone: "+1 214 555 7731", company: "NovaBuild Co", invoices: 11, totalRevenue: 67400, createdAt: "Dec 14, 2024" },
  { id: "6", name: "Apex Digital Agency", email: "billing@apexdigital.com", phone: "+1 312 555 3302", company: "Apex Digital", invoices: 4, totalRevenue: 14200, createdAt: "Feb 18, 2025" },
];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ["#6366f1", "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444"];

export default function CRMPage() {
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState(mockCustomers);
  const [showForm, setShowForm] = useState(false);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.company.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateCustomer = async (data: CreateCustomerInput) => {
    // In production, this calls the API; here we add to local state for demo
    const newCustomer = {
      id: Date.now().toString(),
      name: data.name,
      email: data.email ?? "",
      phone: data.phone ?? "",
      company: data.company ?? "",
      invoices: 0,
      totalRevenue: 0,
      createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };
    setCustomers((prev) => [newCustomer, ...prev]);
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
            {customers.length} total customers · Track relationships and invoices
          </p>
        </div>
        <button className="btn-brand" onClick={() => setShowForm(true)}>
          <Plus size={15} /> Add Customer
        </button>
      </div>

      {/* Search & Filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 380 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input" style={{ width: "auto", paddingRight: 32 }}>
          <option>All customers</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>
        <button className="btn-ghost" style={{ gap: 6, fontSize: 13 }} title="Refresh">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Customer Grid */}
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
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{customer.company}</p>
                </div>
              </div>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
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
            <div style={{
              display: "flex", gap: 0,
              background: "var(--bg-elevated)", borderRadius: 8,
              border: "1px solid var(--border)", marginBottom: 14,
              overflow: "hidden",
            }}>
              {[
                { label: "Revenue", value: `$${(customer.totalRevenue / 1000).toFixed(1)}k` },
                { label: "Invoices", value: customer.invoices.toString() },
                { label: "Since", value: customer.createdAt.split(",")[0] },
              ].map((stat, si) => (
                <div key={stat.label} style={{
                  flex: 1, padding: "10px 12px",
                  borderRight: si < 2 ? "1px solid var(--border)" : "none",
                }}>
                  <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{stat.label}</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              <Link href="/billing/new" style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                gap: 6, padding: "7px 10px", borderRadius: 8,
                background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
                color: "#818cf8", fontSize: 12, fontWeight: 500, textDecoration: "none",
                transition: "all 0.15s",
              }}>
                <FileText size={13} /> Invoice
              </Link>
              <Link href={`/crm/${customer.id}`} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                gap: 6, padding: "7px 10px", borderRadius: 8,
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                color: "var(--text-secondary)", fontSize: 12, fontWeight: 500, textDecoration: "none",
                transition: "all 0.15s",
              }}>
                View <ArrowRight size={12} />
              </Link>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 8 }}>No customers found</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Try adjusting your search or add a new customer.</p>
        </div>
      )}

      {/* Customer Form Modal */}
      {showForm && (
        <CustomerForm
          onClose={() => setShowForm(false)}
          onSubmit={handleCreateCustomer}
        />
      )}
    </div>
  );
}
