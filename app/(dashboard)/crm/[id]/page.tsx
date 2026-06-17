"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Building2,
  FileText,
  AlertCircle,
  Loader,
  Trash2,
  Edit,
  Save,
  X,
  StickyNote,
  CreditCard,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";
import { formatCurrency, formatCompactCurrency } from "@/lib/formatters/currency";
import { formatDate, formatDateTime, toDate } from "@/lib/formatters/date";
import InvoiceStatusSelect from "@/components/InvoiceStatusSelect";
import { getInvoiceStatusMeta } from "@/lib/invoice-status";

// Local, serialization-safe shapes. Dates arrive as ISO strings and
// Decimals as strings once the record has been JSON-serialized by the API.
interface InvoicePayment {
  id: string;
  amount: number | string;
  method: string;
  reference: string | null;
  paidAt: string;
}

interface CustomerInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number | string;
  balanceDue: number | string;
  createdAt: string;
  payments?: InvoicePayment[];
}

interface CustomerData {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  address?: string | null;
  notes?: string | null;
  customerType?: string;
  outstandingAmount?: number | string;
  createdAt: string;
  updatedAt: string;
  invoices?: CustomerInvoice[];
}

type EditableFields = Pick<CustomerData, "name" | "email" | "phone" | "company" | "address" | "notes">;

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<EditableFields>>({});
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const fetchCustomer = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/customers/${customerId}`);
      if (res.status === 404) throw new Error("Customer not found");
      if (!res.ok) throw new Error("Failed to fetch customer");
      const data = (await res.json()) as CustomerData;
      setCustomer(data);
      setFormData({
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company,
        address: data.address,
        notes: data.notes,
      });
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
      setIsEditing(false);
      toast.success("Customer updated");
      await fetchCustomer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update customer");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this customer? This is permanent.")) return;
    try {
      const res = await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete customer");
      toast.success("Customer deleted");
      router.push("/crm");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete customer");
    }
  };

  // ── Optimistic invoice status change (persist + rollback) ───────
  const handleStatusChange = async (invoiceId: string, next: string) => {
    if (!customer) return;
    const previousInvoices = customer.invoices;

    setPendingStatusId(invoiceId);
    setCustomer((prev) =>
      prev
        ? {
            ...prev,
            invoices: prev.invoices?.map((inv) =>
              inv.id === invoiceId ? { ...inv, status: next } : inv
            ),
          }
        : prev
    );

    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to update status");
      }
      toast.success(`Status updated to ${getInvoiceStatusMeta(next).label}`);
    } catch (err) {
      // Roll back to the pre-change invoice list.
      setCustomer((prev) => (prev ? { ...prev, invoices: previousInvoices } : prev));
      toast.error(err instanceof Error ? err.message : "Couldn't update status");
    } finally {
      setPendingStatusId(null);
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

  const invoices = customer.invoices ?? [];
  const totalRevenue = invoices
    .filter((inv) => inv.status === "PAID")
    .reduce((sum, inv) => sum + Number(inv.total), 0);
  const outstandingBalance = invoices
    .filter((inv) => inv.status !== "PAID" && inv.status !== "CANCELLED" && inv.status !== "DRAFT")
    .reduce((sum, inv) => sum + Number(inv.balanceDue), 0);

  // Flatten all payments across this customer's invoices.
  const payments = invoices
    .flatMap((inv) =>
      (inv.payments ?? []).map((p) => ({ ...p, invoiceNumber: inv.invoiceNumber }))
    )
    .sort((a, b) => (toDate(b.paidAt)?.getTime() ?? 0) - (toDate(a.paidAt)?.getTime() ?? 0));
  const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  const createdAt = toDate(customer.createdAt);
  const accountAgeDays = createdAt
    ? Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const labelText = { fontSize: 12, color: "var(--text-muted)", fontWeight: 500, marginBottom: 4 } as const;

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
                <label style={labelText}>Name</label>
                <input
                  className="input"
                  value={formData.name ?? ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ marginTop: 4 }}
                />
              </div>
              <div>
                <label style={labelText}>Email</label>
                <input
                  className="input"
                  value={formData.email ?? ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{ marginTop: 4 }}
                />
              </div>
              <div>
                <label style={labelText}>Phone</label>
                <input
                  className="input"
                  value={formData.phone ?? ""}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  style={{ marginTop: 4 }}
                />
              </div>
              <div>
                <label style={labelText}>Company</label>
                <input
                  className="input"
                  value={formData.company ?? ""}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  style={{ marginTop: 4 }}
                />
              </div>
              <div>
                <label style={labelText}>Address</label>
                <textarea
                  className="input"
                  value={formData.address ?? ""}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  style={{ marginTop: 4, minHeight: 80, fontFamily: "inherit" }}
                />
              </div>
              <div>
                <label style={labelText}>Notes</label>
                <textarea
                  className="input"
                  value={formData.notes ?? ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={{ marginTop: 4, minHeight: 80, fontFamily: "inherit" }}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <p style={labelText}>Name</p>
                <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}>{customer.name}</p>
              </div>

              <div>
                <p style={labelText}>Email</p>
                {customer.email ? (
                  <a
                    href={`mailto:${customer.email}`}
                    style={{ fontSize: 14, color: "var(--brand)", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <Mail size={14} /> {customer.email}
                  </a>
                ) : (
                  <p style={{ fontSize: 14, color: "var(--text-muted)" }}>—</p>
                )}
              </div>

              <div>
                <p style={labelText}>Phone</p>
                {customer.phone ? (
                  <a
                    href={`tel:${customer.phone}`}
                    style={{ fontSize: 14, color: "var(--brand)", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <Phone size={14} /> {customer.phone}
                  </a>
                ) : (
                  <p style={{ fontSize: 14, color: "var(--text-muted)" }}>—</p>
                )}
              </div>

              <div>
                <p style={labelText}>Company</p>
                {customer.company ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)", fontSize: 14 }}>
                    <Building2 size={14} /> {customer.company}
                  </div>
                ) : (
                  <p style={{ fontSize: 14, color: "var(--text-muted)" }}>—</p>
                )}
              </div>

              <div>
                <p style={labelText}>Address</p>
                {customer.address ? (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, color: "var(--text-primary)" }}>
                    <MapPin size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, lineHeight: 1.5 }}>{customer.address}</span>
                  </div>
                ) : (
                  <p style={{ fontSize: 14, color: "var(--text-muted)" }}>—</p>
                )}
              </div>

              <div>
                <p style={labelText}>Notes</p>
                {customer.notes ? (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, color: "var(--text-primary)" }}>
                    <StickyNote size={14} style={{ marginTop: 1, flexShrink: 0, color: "var(--text-muted)" }} />
                    <span style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{customer.notes}</span>
                  </div>
                ) : (
                  <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No notes added</p>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "var(--bg-elevated)", borderRadius: 8, padding: 12 }}>
                  <p style={labelText}>Created</p>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{formatDate(customer.createdAt)}</p>
                </div>
                <div style={{ background: "var(--bg-elevated)", borderRadius: 8, padding: 12 }}>
                  <p style={labelText}>Last Updated</p>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{formatDate(customer.updatedAt)}</p>
                </div>
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
              { label: "Total Revenue", value: formatCompactCurrency(totalRevenue), color: "#10b981" },
              { label: "Outstanding Balance", value: formatCompactCurrency(outstandingBalance), color: "#f59e0b" },
              { label: "Total Invoices", value: invoices.length.toString(), color: "#3b82f6" },
              { label: "Total Payments", value: formatCompactCurrency(totalPayments), color: "#8b5cf6" },
              { label: "Customer Type", value: customer.customerType ?? "—", color: "#6366f1" },
              {
                label: "Account Age",
                value: accountAgeDays !== null ? `${accountAgeDays} days` : "—",
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
        style={{ padding: 24, marginBottom: 24 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <FileText size={18} color="var(--text-muted)" /> Invoice History ({invoices.length})
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
                  <th style={{ textAlign: "left", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>Invoice Number</th>
                  <th style={{ textAlign: "left", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>Date</th>
                  <th style={{ textAlign: "right", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>Amount</th>
                  <th style={{ textAlign: "left", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>Status</th>
                  <th style={{ textAlign: "right", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: 12, color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}>
                      {inv.invoiceNumber}
                    </td>
                    <td style={{ padding: 12, color: "var(--text-secondary)", fontSize: 13 }}>
                      {formatDate(inv.createdAt)}
                    </td>
                    <td style={{ padding: 12, textAlign: "right", color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>
                      {formatCurrency(Number(inv.total))}
                    </td>
                    <td style={{ padding: 12 }}>
                      <InvoiceStatusSelect
                        value={inv.status}
                        pending={pendingStatusId === inv.id}
                        onChange={(next) => handleStatusChange(inv.id, next)}
                      />
                    </td>
                    <td style={{ padding: 12, textAlign: "right" }}>
                      <Link
                        href={`/billing/${inv.id}`}
                        style={{ fontSize: 12, color: "#818cf8", textDecoration: "none", fontWeight: 500 }}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Payments section */}
      <motion.div
        className="surface"
        style={{ padding: 24 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <CreditCard size={18} color="var(--text-muted)" /> Payment History ({payments.length})
        </h2>
        {payments.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: "32px 0" }}>
            No payments recorded yet
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>Date</th>
                  <th style={{ textAlign: "left", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>Invoice</th>
                  <th style={{ textAlign: "left", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>Method</th>
                  <th style={{ textAlign: "left", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>Reference</th>
                  <th style={{ textAlign: "right", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: 12, color: "var(--text-secondary)", fontSize: 13 }}>
                      {formatDateTime(p.paidAt)}
                    </td>
                    <td style={{ padding: 12, color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}>
                      {p.invoiceNumber}
                    </td>
                    <td style={{ padding: 12, color: "var(--text-secondary)", fontSize: 13 }}>
                      {p.method?.replace(/_/g, " ") ?? "—"}
                    </td>
                    <td style={{ padding: 12, color: "var(--text-secondary)", fontSize: 13 }}>
                      {p.reference || "—"}
                    </td>
                    <td style={{ padding: 12, textAlign: "right", color: "#10b981", fontSize: 13, fontWeight: 600 }}>
                      {formatCurrency(Number(p.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
