"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Globe,
  Building2,
  FileText,
  AlertCircle,
  Loader,
  Trash2,
  Edit,
  Save,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import type { Customer, Invoice } from "@prisma/client";

interface CustomerWithData extends Customer {
  invoices?: Invoice[];
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<CustomerWithData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Customer>>({});

  useEffect(() => {
    fetchCustomer();
  }, [customerId]);

  const fetchCustomer = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/customers/${customerId}`);
      if (!res.ok) throw new Error("Failed to fetch customer");
      const data = await res.json();
      setCustomer(data);
      setFormData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!customer) return;
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to update customer");
      const updated = await res.json();
      setCustomer(updated);
      setIsEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update customer");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this customer? This is permanent.")) return;
    try {
      const res = await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete customer");
      router.push("/crm");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete customer");
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
        <Loader size={32} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <button
          onClick={() => router.push("/crm")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 24,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-secondary)",
            fontSize: 14,
          }}
        >
          <ArrowLeft size={16} /> Back to Customers
        </button>
        <div
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 12,
            padding: "20px",
            color: "#ef4444",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <AlertCircle size={20} />
          <span>{error || "Customer not found"}</span>
        </div>
      </div>
    );
  }

  const invoices = customer.invoices || [];
  const totalRevenue = invoices
    .filter((inv) => inv.status === "PAID")
    .reduce((sum, inv) => sum + Number(inv.total), 0);
  const outstandingBalance = invoices
    .filter((inv) => inv.status === "PARTIAL" || inv.status === "OVERDUE")
    .reduce((sum, inv) => sum + Number(inv.balanceDue), 0);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <button
          onClick={() => router.push("/crm")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-secondary)",
            fontSize: 14,
          }}
        >
          <ArrowLeft size={16} /> Back to Customers
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-surface)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                <X size={14} /> Cancel
              </button>
              <button
                onClick={handleUpdate}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "var(--brand)",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                <Save size={14} /> Save Changes
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="btn-ghost"
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px" }}
              >
                <Edit size={14} /> Edit
              </button>
              <button
                onClick={handleDelete}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(239,68,68,0.3)",
                  background: "rgba(239,68,68,0.05)",
                  color: "#ef4444",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* Main content */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        {/* Profile card */}
        <motion.div
          className="surface"
          style={{ padding: 24 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>
            Customer Profile
          </h2>

          {isEditing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>Name</label>
                <input
                  className="input"
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ marginTop: 4 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>Email</label>
                <input
                  className="input"
                  value={formData.email || ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{ marginTop: 4 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>Phone</label>
                <input
                  className="input"
                  value={formData.phone || ""}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  style={{ marginTop: 4 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>Company</label>
                <input
                  className="input"
                  value={formData.company || ""}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  style={{ marginTop: 4 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>Address</label>
                <textarea
                  className="input"
                  value={formData.address || ""}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  style={{ marginTop: 4, minHeight: 80, fontFamily: "inherit" }}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, marginBottom: 4 }}>Name</p>
                <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}>{customer.name}</p>
              </div>
              {customer.email && (
                <div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, marginBottom: 4 }}>
                    Email
                  </p>
                  <a
                    href={`mailto:${customer.email}`}
                    style={{
                      fontSize: 14,
                      color: "var(--brand)",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Mail size={14} /> {customer.email}
                  </a>
                </div>
              )}
              {customer.phone && (
                <div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, marginBottom: 4 }}>
                    Phone
                  </p>
                  <a
                    href={`tel:${customer.phone}`}
                    style={{
                      fontSize: 14,
                      color: "var(--brand)",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Phone size={14} /> {customer.phone}
                  </a>
                </div>
              )}
              {customer.company && (
                <div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, marginBottom: 4 }}>
                    Company
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
                    <Building2 size={14} /> {customer.company}
                  </div>
                </div>
              )}
              {customer.address && (
                <div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, marginBottom: 4 }}>
                    Address
                  </p>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, color: "var(--text-primary)" }}>
                    <MapPin size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, lineHeight: 1.5 }}>{customer.address}</span>
                  </div>
                </div>
              )}
              <div style={{ background: "var(--bg-elevated)", borderRadius: 8, padding: 12 }}>
                <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, marginBottom: 4 }}>
                  Customer ID
                </p>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "monospace" }}>
                  {customer.id}
                </p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Stats card */}
        <motion.div
          className="surface"
          style={{ padding: 24 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>
            Account Overview
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              {
                label: "Total Revenue",
                value: `$${(totalRevenue / 1000).toFixed(1)}k`,
                color: "#10b981",
              },
              {
                label: "Outstanding Balance",
                value: `$${(outstandingBalance / 1000).toFixed(1)}k`,
                color: "#f59e0b",
              },
              {
                label: "Total Invoices",
                value: invoices.length.toString(),
                color: "#3b82f6",
              },
              {
                label: "Paid Invoices",
                value: invoices.filter((inv) => inv.status === "PAID").length.toString(),
                color: "#8b5cf6",
              },
              {
                label: "Customer Type",
                value: customer.customerType,
                color: "#6366f1",
              },
              {
                label: "Account Age",
                value: Math.floor(
                  (new Date().getTime() - customer.createdAt.getTime()) / (1000 * 60 * 60 * 24)
                ) + " days",
                color: "#14b8a6",
              },
            ].map((stat, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingBottom: 12,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>{stat.label}</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Invoices section */}
      <motion.div
        className="surface"
        style={{ padding: 24 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
          Recent Invoices ({invoices.length})
        </h2>
        {invoices.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: "32px 0" }}>
            No invoices yet
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>
                    Invoice Number
                  </th>
                  <th style={{ textAlign: "left", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>
                    Date
                  </th>
                  <th style={{ textAlign: "right", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>
                    Amount
                  </th>
                  <th style={{ textAlign: "left", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: 12, color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}>
                      {inv.invoiceNumber}
                    </td>
                    <td style={{ padding: 12, color: "var(--text-secondary)", fontSize: 13 }}>
                      {format(new Date(inv.createdAt), "MMM d, yyyy")}
                    </td>
                    <td style={{ padding: 12, textAlign: "right", color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>
                      ${(Number(inv.total) / 1000).toFixed(1)}k
                    </td>
                    <td style={{ padding: 12 }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          background:
                            inv.status === "PAID"
                              ? "rgba(16,185,129,0.1)"
                              : inv.status === "OVERDUE"
                                ? "rgba(239,68,68,0.1)"
                                : inv.status === "PARTIAL"
                                  ? "rgba(245,158,11,0.1)"
                                  : "rgba(107,114,128,0.1)",
                          color:
                            inv.status === "PAID"
                              ? "#10b981"
                              : inv.status === "OVERDUE"
                                ? "#ef4444"
                                : inv.status === "PARTIAL"
                                  ? "#f59e0b"
                                  : "#6b7280",
                        }}
                      >
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
