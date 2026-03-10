"use client";

import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Filter,
  Download,
  FileText,
  MoreHorizontal,
  ArrowRight,
  Calendar,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatCurrency, getInvoiceStatusColor } from "@/lib/utils";

const mockInvoices = [
  { id: "INV-00039", customer: "Acme Corporation", email: "billing@acme.com", amount: 8400, status: "PAID", issueDate: "Mar 8, 2025", dueDate: "Mar 22, 2025" },
  { id: "INV-00038", customer: "TechFlow Solutions", email: "accounts@techflow.io", amount: 3200, status: "SENT", issueDate: "Mar 7, 2025", dueDate: "Mar 21, 2025" },
  { id: "INV-00037", customer: "BrightStar Media", email: "hello@brightstar.com", amount: 5800, status: "OVERDUE", issueDate: "Mar 1, 2025", dueDate: "Mar 15, 2025" },
  { id: "INV-00036", customer: "Quantum Ventures", email: "finance@quantumv.com", amount: 1900, status: "PAID", issueDate: "Feb 28, 2025", dueDate: "Mar 14, 2025" },
  { id: "INV-00035", customer: "NovaBuild Partners", email: "ap@novabuild.co", amount: 12100, status: "SENT", issueDate: "Feb 26, 2025", dueDate: "Mar 12, 2025" },
  { id: "INV-00034", customer: "Apex Digital Agency", email: "billing@apexdigital.com", amount: 4500, status: "DRAFT", issueDate: "Feb 24, 2025", dueDate: "Mar 10, 2025" },
  { id: "INV-00033", customer: "Acme Corporation", email: "billing@acme.com", amount: 7200, status: "PAID", issueDate: "Feb 20, 2025", dueDate: "Mar 6, 2025" },
  { id: "INV-00032", customer: "TechFlow Solutions", email: "accounts@techflow.io", amount: 2900, status: "CANCELLED", issueDate: "Feb 15, 2025", dueDate: "Mar 1, 2025" },
];

const statusOptions = ["All", "DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"];

export default function BillingPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filtered = mockInvoices.filter((inv) => {
    const matchSearch =
      inv.customer.toLowerCase().includes(search.toLowerCase()) ||
      inv.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalRevenue = filtered
    .filter((i) => i.status === "PAID")
    .reduce((s, i) => s + i.amount, 0);
  const outstanding = filtered
    .filter((i) => i.status === "SENT" || i.status === "OVERDUE")
    .reduce((s, i) => s + i.amount, 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Billing
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
            Manage invoices, track payments, and monitor outstanding balances.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost">
            <Download size={14} /> Export
          </button>
          <Link href="/billing/new" className="btn-brand">
            <Plus size={15} /> New Invoice
          </Link>
        </div>
      </div>

      {/* Summary strips */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total Invoices", value: filtered.length.toString(), color: "#6366f1" },
          { label: "Paid", value: filtered.filter(i => i.status === "PAID").length.toString(), color: "#10b981" },
          { label: "Outstanding", value: formatCurrency(outstanding), color: "#3b82f6" },
          { label: "Overdue", value: filtered.filter(i => i.status === "OVERDUE").length.toString(), color: "#ef4444" },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            style={{
              padding: "16px 18px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <p style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              {item.label}
            </p>
            <p style={{ fontSize: 22, fontWeight: 700, color: item.color }}>
              {item.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {statusOptions.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 500,
                border: "1px solid",
                cursor: "pointer",
                background: statusFilter === s ? "rgba(99,102,241,0.15)" : "transparent",
                borderColor: statusFilter === s ? "rgba(99,102,241,0.4)" : "var(--border)",
                color: statusFilter === s ? "#818cf8" : "var(--text-secondary)",
                transition: "all 0.15s ease",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice Table */}
      <motion.div
        className="surface"
        style={{ overflow: "hidden" }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Issue Date</th>
              <th>Due Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv) => (
              <tr key={inv.id} style={{ cursor: "pointer" }}>
                <td>
                  <span style={{ fontFamily: "monospace", fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>
                    {inv.id}
                  </span>
                </td>
                <td>
                  <div>
                    <p style={{ color: "var(--text-primary)", fontWeight: 500, fontSize: 14 }}>{inv.customer}</p>
                    <p style={{ color: "var(--text-muted)", fontSize: 11 }}>{inv.email}</p>
                  </div>
                </td>
                <td>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
                    {formatCurrency(inv.amount)}
                  </span>
                </td>
                <td>
                  <span className={`badge ${getInvoiceStatusColor(inv.status)}`}>
                    {inv.status}
                  </span>
                </td>
                <td style={{ fontSize: 13 }}>{inv.issueDate}</td>
                <td style={{ fontSize: 13 }}>{inv.dueDate}</td>
                <td>
                  <Link
                    href={`/billing/${inv.id}`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 12, color: "#818cf8", textDecoration: "none",
                    }}
                  >
                    View <ArrowRight size={12} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
}
