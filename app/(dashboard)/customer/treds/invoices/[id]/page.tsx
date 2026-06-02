"use client";

import { useState, useEffect, use } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Building2,
  CalendarDays,
  Landmark,
  Scale,
  Wallet,
  Activity,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface Bid {
  id: string;
  financierName: string;
  interestRate: number;
  bidAmount: number;
  expiryTime: string;
  status: string;
  createdAt: string;
}

interface Settlement {
  id: string;
  amount: number;
  settlementDate: string;
  status: string;
  utr: string | null;
}

interface ActivityLog {
  id: string;
  action: string;
  description: string;
  createdAt: string;
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  buyerName: string;
  buyerGstin: string | null;
  invoiceAmount: number;
  dueDate: string;
  status: string;
  m1ReferenceId: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  fundedAt: string | null;
  settlementDate: string | null;
  financingRate: number | null;
  financierName: string | null;
  fundingAmount: number | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string;
  bids: Bid[];
  settlement: Settlement | null;
  activityLogs: ActivityLog[];
  integration: { provider: string; status: string } | null;
}

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

const STATUS_LABELS: Record<string, string> = {
  DRAFT:          "Draft",
  READY:          "Ready",
  SUBMITTED:      "Submitted",
  BUYER_APPROVED: "Buyer Approved",
  UNDER_BIDDING:  "Under Bidding",
  DISCOUNTED:     "Discounted",
  SETTLED:        "Settled",
  REJECTED:       "Rejected",
};

const TIMELINE_STEPS = [
  { key: "SUBMITTED",      label: "Submitted",      icon: FileText,     dateKey: "submittedAt" },
  { key: "BUYER_APPROVED", label: "Buyer Approved",  icon: CheckCircle2, dateKey: "approvedAt" },
  { key: "UNDER_BIDDING",  label: "Bidding Open",    icon: Scale,        dateKey: null },
  { key: "DISCOUNTED",     label: "Funded",          icon: Landmark,     dateKey: "fundedAt" },
  { key: "SETTLED",        label: "Settled",         icon: Wallet,       dateKey: "settlementDate" },
];

const STATUS_ORDER = ["DRAFT","READY","SUBMITTED","BUYER_APPROVED","UNDER_BIDDING","DISCOUNTED","SETTLED"];

function Skeleton({ height = 20 }: { height?: number }) {
  return (
    <div style={{ height, background: "var(--bg-elevated)", borderRadius: 6, animation: "pulse 1.5s ease-in-out infinite" }} />
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{value}</span>
    </div>
  );
}

export default function TredsInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/treds/invoices/${id}`);
      if (!res.ok) throw new Error(res.status === 404 ? "Invoice not found" : "Failed to load");
      setInvoice(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  const statusIdx = invoice ? STATUS_ORDER.indexOf(invoice.status) : -1;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link
          href="/customer/treds/invoices"
          style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", textDecoration: "none", fontSize: 13 }}
        >
          <ArrowLeft size={15} />
          Back to Invoices
        </Link>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Skeleton height={120} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Skeleton height={200} />
            <Skeleton height={200} />
          </div>
        </div>
      ) : error ? (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: "24px", textAlign: "center" }}>
          <AlertTriangle size={32} color="#ef4444" style={{ margin: "0 auto 12px" }} />
          <p style={{ color: "#ef4444", fontSize: 14 }}>{error}</p>
          <button onClick={load} className="btn-ghost" style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      ) : invoice ? (
        <div>
          {/* Invoice header card */}
          <motion.div
            className="surface"
            style={{ padding: 24, marginBottom: 20 }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
                    {invoice.invoiceNumber}
                  </h1>
                  <span className={`badge ${STATUS_COLORS[invoice.status] ?? ""}`} style={{ border: "none", fontSize: 11 }}>
                    {STATUS_LABELS[invoice.status] ?? invoice.status}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  Buyer: <strong style={{ color: "var(--text-primary)" }}>{invoice.buyerName}</strong>
                  {invoice.buyerGstin && <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>GSTIN: {invoice.buyerGstin}</span>}
                </p>
                {invoice.m1ReferenceId && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    M1x Ref: <span style={{ fontFamily: "monospace", color: "#818cf8" }}>{invoice.m1ReferenceId}</span>
                  </p>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                  ₹{Number(invoice.invoiceAmount).toLocaleString("en-IN")}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Due: {format(new Date(invoice.dueDate), "dd MMM yyyy")}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Timeline */}
          <motion.div
            className="surface"
            style={{ padding: 24, marginBottom: 20 }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            <h3 className="section-title" style={{ marginBottom: 20, fontSize: 15 }}>TReDS Status Timeline</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", paddingBottom: 4 }}>
              {TIMELINE_STEPS.map((step, i) => {
                const stepIdx = STATUS_ORDER.indexOf(step.key);
                const done = statusIdx >= stepIdx;
                const isCurrent = STATUS_ORDER[statusIdx] === step.key;
                const Icon = step.icon;
                const dateVal = step.dateKey ? (invoice as unknown as Record<string, string | null>)[step.dateKey] : null;
                return (
                  <div key={step.key} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 100 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: done
                            ? isCurrent
                              ? "rgba(99,102,241,0.2)"
                              : "rgba(16,185,129,0.15)"
                            : "var(--bg-elevated)",
                          border: done
                            ? isCurrent
                              ? "2px solid #6366f1"
                              : "2px solid #10b981"
                            : "2px solid var(--border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <Icon
                          size={15}
                          color={done ? (isCurrent ? "#818cf8" : "#10b981") : "var(--text-muted)"}
                          strokeWidth={1.75}
                        />
                      </div>
                      <p style={{ fontSize: 11, fontWeight: done ? 600 : 400, color: done ? "var(--text-primary)" : "var(--text-muted)", marginTop: 6, textAlign: "center", whiteSpace: "nowrap" }}>
                        {step.label}
                      </p>
                      {dateVal && (
                        <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                          {format(new Date(dateVal), "dd MMM")}
                        </p>
                      )}
                    </div>
                    {i < TIMELINE_STEPS.length - 1 && (
                      <div
                        style={{
                          height: 2,
                          flex: 1,
                          background: statusIdx > STATUS_ORDER.indexOf(step.key) ? "#10b981" : "var(--border)",
                          minWidth: 24,
                          transition: "background 0.3s ease",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Main content grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            {/* Invoice Information */}
            <motion.div
              className="surface"
              style={{ padding: 20 }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <FileText size={15} color="#818cf8" />
                <h3 className="section-title" style={{ fontSize: 15 }}>Invoice Details</h3>
              </div>
              <InfoRow label="Invoice Number" value={<span style={{ fontFamily: "monospace" }}>{invoice.invoiceNumber}</span>} />
              <InfoRow label="Invoice Amount" value={`₹${Number(invoice.invoiceAmount).toLocaleString("en-IN")}`} />
              <InfoRow label="Due Date" value={format(new Date(invoice.dueDate), "dd MMMM yyyy")} />
              <InfoRow label="Submitted" value={invoice.submittedAt ? format(new Date(invoice.submittedAt), "dd MMM yyyy, HH:mm") : "—"} />
              {invoice.notes && <InfoRow label="Notes" value={invoice.notes} />}
            </motion.div>

            {/* Buyer Information */}
            <motion.div
              className="surface"
              style={{ padding: 20 }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Building2 size={15} color="#3b82f6" />
                <h3 className="section-title" style={{ fontSize: 15 }}>Buyer Information</h3>
              </div>
              <InfoRow label="Buyer Name" value={invoice.buyerName} />
              <InfoRow label="GSTIN" value={invoice.buyerGstin ?? "—"} />
              <InfoRow label="Approval Status" value={
                invoice.approvedAt
                  ? <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#10b981" }}><CheckCircle2 size={12} /> Approved on {format(new Date(invoice.approvedAt), "dd MMM yyyy")}</span>
                  : invoice.status === "REJECTED"
                  ? <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#ef4444" }}><XCircle size={12} /> Rejected</span>
                  : <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#f59e0b" }}><Clock size={12} /> Pending</span>
              } />
              {invoice.rejectionReason && <InfoRow label="Rejection Reason" value={<span style={{ color: "#ef4444" }}>{invoice.rejectionReason}</span>} />}
            </motion.div>
          </div>

          {/* Financing Details + Settlement */}
          {(invoice.financierName || invoice.settlement) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              {/* Financing */}
              {invoice.financierName && (
                <motion.div
                  className="surface"
                  style={{ padding: 20 }}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <Landmark size={15} color="#10b981" />
                    <h3 className="section-title" style={{ fontSize: 15 }}>Financing Details</h3>
                  </div>
                  <InfoRow label="Financier" value={invoice.financierName} />
                  <InfoRow label="Interest Rate" value={invoice.financingRate !== null ? `${Number(invoice.financingRate).toFixed(3)}% p.a.` : "—"} />
                  <InfoRow label="Funding Amount" value={invoice.fundingAmount !== null ? `₹${Number(invoice.fundingAmount).toLocaleString("en-IN")}` : "—"} />
                  <InfoRow label="Funded On" value={invoice.fundedAt ? format(new Date(invoice.fundedAt), "dd MMM yyyy") : "—"} />
                </motion.div>
              )}

              {/* Settlement */}
              {invoice.settlement && (
                <motion.div
                  className="surface"
                  style={{ padding: 20 }}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.24 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <Wallet size={15} color="#8b5cf6" />
                    <h3 className="section-title" style={{ fontSize: 15 }}>Settlement</h3>
                  </div>
                  <InfoRow label="Amount" value={`₹${Number(invoice.settlement.amount).toLocaleString("en-IN")}`} />
                  <InfoRow label="Settlement Date" value={format(new Date(invoice.settlement.settlementDate), "dd MMM yyyy")} />
                  <InfoRow label="UTR" value={<span style={{ fontFamily: "monospace" }}>{invoice.settlement.utr ?? "—"}</span>} />
                  <InfoRow label="Status" value={
                    <span className={`badge ${
                      invoice.settlement.status === "PAID" ? "bg-emerald-500/20 text-emerald-400" :
                      invoice.settlement.status === "FAILED" ? "bg-red-500/20 text-red-400" :
                      invoice.settlement.status === "PROCESSING" ? "bg-blue-500/20 text-blue-400" :
                      "bg-amber-500/20 text-amber-400"
                    }`} style={{ border: "none", fontSize: 10 }}>
                      {invoice.settlement.status}
                    </span>
                  } />
                </motion.div>
              )}
            </div>
          )}

          {/* Bids Table */}
          {invoice.bids.length > 0 && (
            <motion.div
              className="surface"
              style={{ marginBottom: 20, overflow: "hidden" }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
            >
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                <Scale size={15} color="#f59e0b" />
                <h3 className="section-title" style={{ fontSize: 15 }}>Bid History</h3>
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>({invoice.bids.length} bids)</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Financier</th>
                      <th>Interest Rate</th>
                      <th>Bid Amount</th>
                      <th>Expiry</th>
                      <th>Status</th>
                      <th>Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.bids.map((bid) => (
                      <tr key={bid.id}>
                        <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>{bid.financierName}</td>
                        <td style={{ color: bid.status === "ACCEPTED" ? "#10b981" : "var(--text-primary)", fontWeight: bid.status === "ACCEPTED" ? 700 : 400 }}>
                          {Number(bid.interestRate).toFixed(3)}% p.a.
                        </td>
                        <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          ₹{Number(bid.bidAmount).toLocaleString("en-IN")}
                        </td>
                        <td style={{ fontSize: 12 }}>{format(new Date(bid.expiryTime), "dd MMM, HH:mm")}</td>
                        <td>
                          <span className={`badge ${
                            bid.status === "ACCEPTED" ? "bg-emerald-500/20 text-emerald-400" :
                            bid.status === "EXPIRED" ? "bg-zinc-500/20 text-zinc-400" :
                            bid.status === "REJECTED" ? "bg-red-500/20 text-red-400" :
                            "bg-amber-500/20 text-amber-400"
                          }`} style={{ border: "none", fontSize: 10 }}>
                            {bid.status}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}>{format(new Date(bid.createdAt), "dd MMM, HH:mm")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Activity Log */}
          {invoice.activityLogs.length > 0 && (
            <motion.div
              className="surface"
              style={{ padding: 20 }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Activity size={15} color="var(--text-muted)" />
                <h3 className="section-title" style={{ fontSize: 15 }}>Activity Log</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {invoice.activityLogs.map((log, i) => (
                  <div key={log.id} style={{ display: "flex", gap: 14, paddingBottom: 16 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1", flexShrink: 0, marginTop: 3 }} />
                      {i < invoice.activityLogs.length - 1 && (
                        <div style={{ width: 1, flex: 1, background: "var(--border)", minHeight: 20, marginTop: 4 }} />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{log.action}</p>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 1 }}>{log.description}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                        <CalendarDays size={10} style={{ display: "inline", marginRight: 3, verticalAlign: "middle" }} />
                        {format(new Date(log.createdAt), "dd MMM yyyy, HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      ) : null}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
