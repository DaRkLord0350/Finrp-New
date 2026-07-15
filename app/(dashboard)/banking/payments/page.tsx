"use client";

// ============================================================
// /banking/payments — TBX Payments queue: every vendor-bill payment
// across all statuses, with the Checker approve/reject actions for
// payments awaiting approval. Backed by /api/banking/payments.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import { RefreshCw, CheckCircle2, XCircle, Inbox, Loader } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

interface PaymentRow {
  id: string;
  amount: string | number;
  paymentType: "NEFT" | "RTGS" | "IMPS" | "BULK" | "SCHEDULED";
  status: string;
  tbxUtr: string | null;
  failureReason: string | null;
  createdAt: string;
  purchase: { id: string; purchaseNumber: string; vendorName: string | null; vendor: { id: string; name: string } | null };
  bankAccount: { accountName: string; bankName: string } | null;
  maker: { id: string; name: string } | null;
  checker: { id: string; name: string } | null;
}

const statusMeta: Record<string, { color: string; bg: string; label: string }> = {
  DRAFT: { color: "#64748b", bg: "rgba(100,116,139,0.12)", label: "Draft" },
  MAKER_PENDING: { color: "#64748b", bg: "rgba(100,116,139,0.12)", label: "Maker Pending" },
  CHECKER_PENDING: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", label: "Checker Pending" },
  SUBMITTED: { color: "#0ea5e9", bg: "rgba(14,165,233,0.12)", label: "Submitted" },
  PROCESSING: { color: "#0ea5e9", bg: "rgba(14,165,233,0.12)", label: "Processing" },
  SUCCESS: { color: "#10b981", bg: "rgba(16,185,129,0.12)", label: "Success" },
  FAILED: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", label: "Failed" },
  CANCELLED: { color: "#64748b", bg: "rgba(100,116,139,0.12)", label: "Cancelled" },
};

const FILTERS = ["ALL", "CHECKER_PENDING", "PROCESSING", "SUCCESS", "FAILED"] as const;

function inr(n: unknown) {
  return `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function PaymentsQueuePage() {
  const { can } = usePermissions();
  const canApprove = can("banking.approve");
  const [rows, setRows] = useState<PaymentRow[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const url = filter === "ALL" ? "/api/banking/payments" : `/api/banking/payments?status=${filter}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load payments");
      setRows(await res.json());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load payments");
      setRows([]);
    }
  }, [filter]);

  useEffect(() => {
    setRows(null);
    load();
  }, [load]);

  const stats = useMemo(() => {
    const all = rows ?? [];
    return {
      pending: all.filter((r) => r.status === "CHECKER_PENDING").length,
      inFlight: all.filter((r) => r.status === "SUBMITTED" || r.status === "PROCESSING").length,
      succeeded: all.filter((r) => r.status === "SUCCESS").reduce((s, r) => s + Number(r.amount), 0),
      failed: all.filter((r) => r.status === "FAILED").length,
    };
  }, [rows]);

  const approve = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/banking/payments/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to approve payment");
      toast.success("Payment approved — dispatching to TBX");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve payment");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: string) => {
    const reason = window.prompt("Reason for rejecting this payment?");
    if (reason === null) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/banking/payments/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to reject payment");
      toast.success("Payment rejected");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject payment");
    } finally {
      setBusyId(null);
    }
  };

  const loading = rows === null;

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="section-title">TBX Payments</h1>
          <p className="section-subtitle">Vendor-bill payments with Maker-Checker approval, dispatched via TBX Corporate Internet Banking.</p>
        </div>
        <button onClick={load} className="btn-ghost" style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div className="stat-card"><p style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b" }}>{loading ? "—" : stats.pending}</p><p style={{ fontSize: 12, color: "var(--text-muted)" }}>Awaiting Approval</p></div>
        <div className="stat-card"><p style={{ fontSize: 24, fontWeight: 700, color: "#0ea5e9" }}>{loading ? "—" : stats.inFlight}</p><p style={{ fontSize: 12, color: "var(--text-muted)" }}>In Flight</p></div>
        <div className="stat-card"><p style={{ fontSize: 24, fontWeight: 700, color: "#10b981" }}>{loading ? "—" : inr(stats.succeeded)}</p><p style={{ fontSize: 12, color: "var(--text-muted)" }}>Settled</p></div>
        <div className="stat-card"><p style={{ fontSize: 24, fontWeight: 700, color: "#ef4444" }}>{loading ? "—" : stats.failed}</p><p style={{ fontSize: 12, color: "var(--text-muted)" }}>Failed</p></div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={filter === f ? "btn-primary" : "btn-ghost"}
            style={{ padding: "6px 12px", fontSize: 12 }}
          >
            {f === "ALL" ? "All" : statusMeta[f]?.label ?? f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="section-card" style={{ padding: 24 }}>
          <Loader size={20} style={{ animation: "spin 1s linear infinite" }} color="var(--text-muted)" />
        </div>
      ) : rows!.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <Inbox size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No payments here</p>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Payments submitted for Bills appear here.</p>
          </div>
        </div>
      ) : (
        <motion.div className="surface" style={{ padding: 0, overflow: "auto" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Bill</th>
                <th>Vendor</th>
                <th>Type</th>
                <th>From</th>
                <th>Maker → Checker</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows!.map((p) => {
                const meta = statusMeta[p.status] ?? statusMeta.DRAFT;
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/erp/purchases/${p.purchase.id}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {p.purchase.purchaseNumber}
                      </Link>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{format(new Date(p.createdAt), "dd MMM yyyy, HH:mm")}</p>
                    </td>
                    <td style={{ fontSize: 12.5 }}>
                      {p.purchase.vendor ? <Link href={`/erp/vendors/${p.purchase.vendor.id}`}>{p.purchase.vendor.name}</Link> : p.purchase.vendorName ?? "—"}
                    </td>
                    <td style={{ fontSize: 12 }}>{p.paymentType}</td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.bankAccount?.accountName ?? "—"}</td>
                    <td style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                      {p.maker?.name ?? "—"} → {p.checker?.name ?? "—"}
                    </td>
                    <td>
                      <span className="badge" style={{ background: meta.bg, color: meta.color, border: "none", fontSize: 10 }}>{meta.label}</span>
                      {p.failureReason && <p style={{ fontSize: 10.5, color: "#ef4444", marginTop: 2, maxWidth: 180 }}>{p.failureReason}</p>}
                      {p.tbxUtr && <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>UTR {p.tbxUtr}</p>}
                    </td>
                    <td style={{ textAlign: "right", fontSize: 13, fontWeight: 600 }}>{inr(p.amount)}</td>
                    <td>
                      {p.status === "CHECKER_PENDING" && canApprove && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => approve(p.id)}
                            disabled={busyId === p.id}
                            title="Approve"
                            className="btn-ghost"
                            style={{ padding: 6, color: "#10b981" }}
                          >
                            <CheckCircle2 size={16} />
                          </button>
                          <button
                            onClick={() => reject(p.id)}
                            disabled={busyId === p.id}
                            title="Reject"
                            className="btn-ghost"
                            style={{ padding: 6, color: "#ef4444" }}
                          >
                            <XCircle size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
