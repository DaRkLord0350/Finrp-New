"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Search,
  Filter,
  Download,
  Plus,
  RefreshCw,
  X,
  CheckSquare,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTredsInvoices } from "@/hooks/useTredsInvoices";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "READY", label: "Ready" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "BUYER_APPROVED", label: "Buyer Approved" },
  { value: "UNDER_BIDDING", label: "Under Bidding" },
  { value: "DISCOUNTED", label: "Discounted" },
  { value: "SETTLED", label: "Settled" },
  { value: "REJECTED", label: "Rejected" },
];

const STATUS_COLORS: Record<string, string> = {
  DRAFT:          "bg-zinc-500/20 text-zinc-400",
  READY:          "bg-blue-500/20 text-blue-400",
  SUBMITTED:      "bg-indigo-500/20 text-indigo-400",
  BUYER_APPROVED: "bg-cyan-500/20 text-cyan-400",
  UNDER_BIDDING:  "bg-amber-500/20 text-amber-400",
  DISCOUNTED:     "bg-emerald-500/20 text-emerald-400",
  SETTLED:        "bg-green-500/20 text-green-400",
  REJECTED:       "bg-red-500/20 text-red-400",
};

function Skeleton({ height = 44 }: { height?: number }) {
  return (
    <tr>
      <td colSpan={9} style={{ padding: 0 }}>
        <div style={{ height, background: "var(--bg-elevated)", margin: "3px 0", borderRadius: 6, animation: "pulse 1.5s ease-in-out infinite" }} />
      </td>
    </tr>
  );
}

// ── Submit Invoice Modal ──────────────────────────────────────
function SubmitModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    invoiceNumber: "",
    buyerName: "",
    buyerGstin: "",
    invoiceAmount: "",
    dueDate: "",
    notes: "",
    declare: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.declare) {
      setError("Please accept the declaration before submitting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/treds/invoices/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: form.invoiceNumber,
          buyerName: form.buyerName,
          buyerGstin: form.buyerGstin || undefined,
          invoiceAmount: parseFloat(form.invoiceAmount),
          dueDate: form.dueDate,
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      toast.success(`Invoice submitted! M1x Ref: ${data.m1ReferenceId}`);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 28,
          width: "100%",
          maxWidth: 540,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>Submit to M1xchange</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>Submit invoice for TReDS discounting</p>
          </div>
          <button className="btn-ghost" onClick={onClose} style={{ padding: "6px 8px" }}>
            <X size={16} />
          </button>
        </div>

        {error && (
          <div
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#ef4444",
              fontSize: 13,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="label">Invoice Number *</label>
                <input
                  className="input"
                  required
                  placeholder="INV-001"
                  value={form.invoiceNumber}
                  onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Invoice Amount (₹) *</label>
                <input
                  className="input"
                  type="number"
                  required
                  min="1"
                  placeholder="500000"
                  value={form.invoiceAmount}
                  onChange={(e) => setForm({ ...form, invoiceAmount: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label">Buyer Name *</label>
              <input
                className="input"
                required
                placeholder="Reliance Industries Ltd"
                value={form.buyerName}
                onChange={(e) => setForm({ ...form, buyerName: e.target.value })}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="label">Buyer GSTIN</label>
                <input
                  className="input"
                  placeholder="27AABCR1234M1Z5"
                  value={form.buyerGstin}
                  onChange={(e) => setForm({ ...form, buyerGstin: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Due Date *</label>
                <input
                  className="input"
                  type="date"
                  required
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea
                className="input"
                rows={2}
                placeholder="Additional context for the financier..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                style={{ resize: "vertical" }}
              />
            </div>

            <div
              style={{
                background: "rgba(99,102,241,0.06)",
                border: "1px solid rgba(99,102,241,0.2)",
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.declare}
                  onChange={(e) => setForm({ ...form, declare: e.target.checked })}
                  style={{ marginTop: 2, accentColor: "#6366f1", flexShrink: 0 }}
                />
                <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  I declare that the invoice details are accurate, the goods/services have been delivered, and this invoice is eligible for TReDS discounting under applicable RBI guidelines.
                </span>
              </label>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>
              Cancel
            </button>
            <button type="submit" className="btn-brand" disabled={submitting} style={{ flex: 1 }}>
              {submitting ? "Submitting..." : "Submit to M1xchange"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function TredsInvoicesPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortCol, setSortCol] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const { invoices, total, loading, error, refetch } = useTredsInvoices(statusFilter || undefined, search || undefined);

  function handleSearchChange(v: string) {
    setSearchInput(v);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setSearch(v), 350);
  }

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return null;
    return sortDir === "asc" ? <ChevronUp size={11} style={{ marginLeft: 3, opacity: 0.7 }} /> : <ChevronDown size={11} style={{ marginLeft: 3, opacity: 0.7 }} />;
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exportCSV() {
    if (invoices.length === 0) return;
    const headers = ["Invoice #", "Buyer", "Amount", "Due Date", "Status", "Financier", "Rate", "Funded Amount"];
    const rows = invoices.map((inv) => [
      inv.invoiceNumber,
      inv.buyerName,
      inv.invoiceAmount,
      format(new Date(inv.dueDate), "yyyy-MM-dd"),
      inv.status,
      inv.financierName ?? "",
      inv.financingRate ?? "",
      inv.fundingAmount ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `treds-invoices-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  const sorted = [...invoices].sort((a, b) => {
    const mult = sortDir === "asc" ? 1 : -1;
    if (sortCol === "invoiceAmount") return mult * (a.invoiceAmount - b.invoiceAmount);
    if (sortCol === "dueDate") return mult * (new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const av = String((a as unknown as Record<string, unknown>)[sortCol] ?? "");
    const bv = String((b as unknown as Record<string, unknown>)[sortCol] ?? "");
    return mult * av.localeCompare(bv);
  });

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            TReDS Invoices
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>
            {loading ? "Loading..." : `${total} invoice${total !== 1 ? "s" : ""} total`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-ghost" onClick={refetch} style={{ padding: "7px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
            <RefreshCw size={13} />
            Refresh
          </button>
          <button className="btn-ghost" onClick={exportCSV} style={{ padding: "7px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
            <Download size={13} />
            Export CSV
          </button>
          <button className="btn-brand" onClick={() => setShowModal(true)} style={{ padding: "7px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
            <Plus size={13} />
            Submit to M1xchange
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 360 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            className="input"
            style={{ paddingLeft: 32 }}
            placeholder="Search by invoice #, buyer, M1x ref..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <div style={{ position: "relative" }}>
          <Filter size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <select
            className="input"
            style={{ paddingLeft: 30, paddingRight: 28, appearance: "none", cursor: "pointer", minWidth: 160 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {(statusFilter || search) && (
          <button
            className="btn-ghost"
            onClick={() => { setStatusFilter(""); setSearch(""); setSearchInput(""); }}
            style={{ padding: "7px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
          >
            <X size={12} />
            Clear
          </button>
        )}

        {selected.size > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{selected.size} selected</span>
            <button className="btn-ghost" style={{ padding: "5px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
              <CheckSquare size={12} />
              Bulk Action
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#ef4444", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={14} />
          {error}
          <button onClick={refetch} style={{ color: "#ef4444", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>Retry</button>
        </div>
      )}

      {/* Table */}
      <motion.div
        className="surface"
        style={{ overflow: "hidden" }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={selected.size === invoices.length && invoices.length > 0}
                    onChange={() => {
                      if (selected.size === invoices.length) setSelected(new Set());
                      else setSelected(new Set(invoices.map((i) => i.id)));
                    }}
                    style={{ accentColor: "#6366f1" }}
                  />
                </th>
                <th onClick={() => toggleSort("invoiceNumber")} style={{ cursor: "pointer", userSelect: "none" }}>
                  Invoice # <SortIcon col="invoiceNumber" />
                </th>
                <th onClick={() => toggleSort("buyerName")} style={{ cursor: "pointer", userSelect: "none" }}>
                  Buyer <SortIcon col="buyerName" />
                </th>
                <th onClick={() => toggleSort("invoiceAmount")} style={{ cursor: "pointer", userSelect: "none" }}>
                  Amount <SortIcon col="invoiceAmount" />
                </th>
                <th onClick={() => toggleSort("dueDate")} style={{ cursor: "pointer", userSelect: "none" }}>
                  Due Date <SortIcon col="dueDate" />
                </th>
                <th>Status</th>
                <th>Financier</th>
                <th>Rate</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(8)].map((_, i) => <Skeleton key={i} />)
                : sorted.length === 0
                ? (
                  <tr>
                    <td colSpan={9} style={{ padding: "56px 24px", textAlign: "center" }}>
                      <FileText size={40} color="var(--text-muted)" style={{ margin: "0 auto 12px" }} />
                      <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No invoices found</p>
                      <button
                        className="btn-brand"
                        onClick={() => setShowModal(true)}
                        style={{ marginTop: 14, padding: "8px 16px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
                      >
                        <Plus size={13} />
                        Submit your first invoice
                      </button>
                    </td>
                  </tr>
                )
                : sorted.map((inv) => (
                  <tr key={inv.id} style={{ cursor: "pointer" }} onClick={() => toggleSelect(inv.id)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(inv.id)}
                        onChange={() => toggleSelect(inv.id)}
                        style={{ accentColor: "#6366f1" }}
                      />
                    </td>
                    <td style={{ fontFamily: "monospace", color: "#818cf8", fontSize: 13 }}>
                      {inv.invoiceNumber}
                    </td>
                    <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>{inv.buyerName}</td>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      ₹{Number(inv.invoiceAmount).toLocaleString("en-IN")}
                    </td>
                    <td style={{ fontSize: 12 }}>{format(new Date(inv.dueDate), "dd MMM yyyy")}</td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[inv.status] ?? ""}`} style={{ border: "none", fontSize: 10, whiteSpace: "nowrap" }}>
                        {STATUS_OPTIONS.find((o) => o.value === inv.status)?.label ?? inv.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{inv.financierName ?? "—"}</td>
                    <td style={{ fontSize: 12 }}>
                      {inv.financingRate !== null ? `${Number(inv.financingRate).toFixed(2)}%` : "—"}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/customer/treds/invoices/${inv.id}`}
                        style={{
                          fontSize: 12,
                          color: "#818cf8",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        View <ExternalLink size={11} />
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Submit Modal */}
      <AnimatePresence>
        {showModal && (
          <SubmitModal onClose={() => setShowModal(false)} onSuccess={refetch} />
        )}
      </AnimatePresence>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
