"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Scale,
  RefreshCw,
  Clock,
  AlertTriangle,
  TrendingDown,
  Landmark,
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
  tredsInvoice: {
    id: string;
    invoiceNumber: string;
    buyerName: string;
    invoiceAmount: number;
    status: string;
    dueDate: string;
  };
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:   "bg-emerald-500/20 text-emerald-400",
  ACCEPTED: "bg-blue-500/20 text-blue-400",
  REJECTED: "bg-red-500/20 text-red-400",
  EXPIRED:  "bg-zinc-500/20 text-zinc-400",
};

function CountdownBadge({ expiryTime, status }: { expiryTime: string; status: string }) {
  const [msLeft, setMsLeft] = useState(new Date(expiryTime).getTime() - Date.now());

  useEffect(() => {
    if (status !== "ACTIVE") return;
    const t = setInterval(() => setMsLeft(new Date(expiryTime).getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiryTime, status]);

  if (status !== "ACTIVE" || msLeft <= 0) {
    return <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>;
  }

  const h = Math.floor(msLeft / 3600000);
  const m = Math.floor((msLeft % 3600000) / 60000);
  const s = Math.floor((msLeft % 60000) / 1000);
  const urgent = msLeft < 3600000;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        borderRadius: 6,
        background: urgent ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
        border: `1px solid ${urgent ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "monospace",
        color: urgent ? "#ef4444" : "#10b981",
      }}
    >
      <Clock size={10} />
      {h > 0 && `${h}h `}{m.toString().padStart(2, "0")}m {s.toString().padStart(2, "0")}s
    </div>
  );
}

function Skeleton({ height = 60 }: { height?: number }) {
  return (
    <div style={{ height, background: "var(--bg-elevated)", borderRadius: 12, marginBottom: 10, animation: "pulse 1.5s ease-in-out infinite" }} />
  );
}

export default function TredsBidsPage() {
  const [bids, setBids] = useState<Bid[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/treds/bids");
      if (!res.ok) throw new Error("Failed to load bids");
      const data = await res.json();
      setBids(data.bids ?? []);
      setTotal(data.total ?? 0);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [load]);

  // Group bids by invoice
  const grouped = new Map<string, Bid[]>();
  for (const bid of bids) {
    const key = bid.tredsInvoice.id;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(bid);
  }

  const activeBids = bids.filter((b) => b.status === "ACTIVE");
  const bestBid = activeBids.sort((a, b) => a.interestRate - b.interestRate)[0];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Live Bid Monitoring
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>
            {loading ? "Loading..." : `${total} bid${total !== 1 ? "s" : ""} · Auto-refresh every 30s · Last: ${format(lastRefresh, "HH:mm:ss")}`}
          </p>
        </div>
        <button className="btn-ghost" onClick={load} style={{ padding: "7px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
          <RefreshCw size={13} />
          Refresh Now
        </button>
      </div>

      {/* Best Bid Banner */}
      {!loading && bestBid && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.25)",
            borderRadius: 12,
            padding: "14px 20px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <TrendingDown size={16} color="#10b981" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#10b981", letterSpacing: "0.04em" }}>BEST ACTIVE BID</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>
              {Number(bestBid.interestRate).toFixed(3)}% p.a. — {bestBid.financierName}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Invoice</p>
            <Link href={`/customer/treds/invoices/${bestBid.tredsInvoice.id}`} style={{ fontSize: 13, color: "#818cf8", textDecoration: "none", fontWeight: 600 }}>
              {bestBid.tredsInvoice.invoiceNumber}
            </Link>
          </div>
        </motion.div>
      )}

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#ef4444", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {/* Bid Cards by Invoice */}
      {loading ? (
        <div>{[...Array(4)].map((_, i) => <Skeleton key={i} height={140} />)}</div>
      ) : bids.length === 0 ? (
        <motion.div
          className="surface"
          style={{ padding: "60px 24px", textAlign: "center" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Scale size={44} color="var(--text-muted)" style={{ margin: "0 auto 16px" }} />
          <p style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No bids yet</p>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>
            Bids appear here once financiers start bidding on your submitted invoices.
          </p>
          <Link href="/customer/treds/invoices" className="btn-brand" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", padding: "8px 16px", fontSize: 13 }}>
            View Invoices
          </Link>
        </motion.div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {Array.from(grouped.entries()).map(([invoiceId, invBids], gi) => {
            const inv = invBids[0].tredsInvoice;
            const sortedBids = [...invBids].sort((a, b) => a.interestRate - b.interestRate);
            const lowestRate = sortedBids[0]?.interestRate;
            return (
              <motion.div
                key={invoiceId}
                className="surface"
                style={{ overflow: "hidden" }}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.06 }}
              >
                {/* Invoice header */}
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "var(--bg-elevated)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Landmark size={14} color="#818cf8" />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Link href={`/customer/treds/invoices/${inv.id}`} style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", textDecoration: "none" }}>
                          {inv.invoiceNumber}
                        </Link>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>· {inv.buyerName}</span>
                      </div>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                        Amount: <strong style={{ color: "var(--text-primary)" }}>₹{Number(inv.invoiceAmount).toLocaleString("en-IN")}</strong>
                        &nbsp;· Due: {format(new Date(inv.dueDate), "dd MMM yyyy")}
                        &nbsp;· {sortedBids.length} bid{sortedBids.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  {lowestRate !== undefined && (
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Best Rate</p>
                      <p style={{ fontSize: 18, fontWeight: 700, color: "#10b981" }}>
                        {Number(lowestRate).toFixed(3)}%
                      </p>
                    </div>
                  )}
                </div>

                {/* Bids */}
                <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {sortedBids.map((bid, i) => (
                    <div
                      key={bid.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 16px",
                        background: i === 0 && bid.status === "ACTIVE" ? "rgba(16,185,129,0.06)" : "var(--bg-elevated)",
                        border: `1px solid ${i === 0 && bid.status === "ACTIVE" ? "rgba(16,185,129,0.2)" : "var(--border)"}`,
                        borderRadius: 10,
                      }}
                    >
                      {i === 0 && bid.status === "ACTIVE" && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: "#10b981", background: "rgba(16,185,129,0.15)", padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>
                          BEST
                        </span>
                      )}
                      <p style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14, minWidth: 140 }}>
                        {bid.financierName}
                      </p>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                        <span style={{ fontSize: 18, fontWeight: 700, color: i === 0 ? "#10b981" : "var(--text-primary)" }}>
                          {Number(bid.interestRate).toFixed(3)}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>% p.a.</span>
                      </div>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginLeft: 8 }}>
                        ₹{Number(bid.bidAmount).toLocaleString("en-IN")}
                      </p>
                      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
                        <CountdownBadge expiryTime={bid.expiryTime} status={bid.status} />
                        <span className={`badge ${STATUS_COLORS[bid.status] ?? ""}`} style={{ border: "none", fontSize: 10 }}>
                          {bid.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
