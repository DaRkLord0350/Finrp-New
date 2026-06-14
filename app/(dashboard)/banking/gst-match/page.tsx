"use client";

import { useState } from "react";
import { Receipt, CheckCircle2, AlertTriangle, XCircle, Search, Loader2, RefreshCw } from "lucide-react";
import { useQuery, useQueryClient } from "@/lib/queryCache";

interface GSTMatch {
  id: string;
  gstrType: string | null;
  gstrPeriod: string | null;
  invoiceNumber: string | null;
  gstin: string | null;
  vendorName: string | null;
  amount: number;
  gstAmount: number | null;
  matchStatus: "MATCHED" | "PARTIAL" | "MISMATCH" | "MISSING_INVOICE" | "MISSING_RETURN" | "UNMATCHED";
  confidence: number | null;
  issues: { type: string; description: string }[] | null;
  createdAt: string;
}

interface Stats {
  total: number; matched: number; partial: number; issues: number; missingITC: number;
}

const MATCH_STYLES: Record<string, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
  MATCHED:         { bg: "rgba(16,185,129,0.1)",   text: "#10b981", label: "Matched",         icon: <CheckCircle2 size={10} /> },
  PARTIAL:         { bg: "rgba(99,102,241,0.1)",   text: "#818cf8", label: "Partial",         icon: <AlertTriangle size={10} /> },
  MISMATCH:        { bg: "rgba(239,68,68,0.1)",    text: "#ef4444", label: "Mismatch",        icon: <XCircle size={10} /> },
  MISSING_RETURN:  { bg: "rgba(239,68,68,0.1)",    text: "#ef4444", label: "Missing Return",  icon: <XCircle size={10} /> },
  MISSING_INVOICE: { bg: "rgba(245,158,11,0.1)",   text: "#f59e0b", label: "Missing Invoice", icon: <AlertTriangle size={10} /> },
  UNMATCHED:       { bg: "rgba(100,116,139,0.1)",  text: "#64748b", label: "Unmatched",       icon: <AlertTriangle size={10} /> },
};

function formatINR(n: number | null) {
  if (n === null || n === undefined) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function GSTMatchPage() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery(
    ["banking", "gst-match", filter],
    async () => {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      const r = await fetch(`/api/banking/gst-match?${params}`);
      if (!r.ok) return { matches: [] as GSTMatch[], stats: { total: 0, matched: 0, partial: 0, issues: 0, missingITC: 0 } as Stats };
      return r.json() as Promise<{ matches: GSTMatch[]; stats: Stats }>;
    },
    { staleTime: 60_000 }
  );

  const allMatches = data?.matches ?? [];
  const stats = data?.stats ?? { total: 0, matched: 0, partial: 0, issues: 0, missingITC: 0 };
  const healthPct = stats.total > 0 ? Math.round((stats.matched / stats.total) * 100) : 0;

  const filtered = allMatches.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (m.vendorName?.toLowerCase().includes(q) || m.invoiceNumber?.toLowerCase().includes(q) || m.gstin?.toLowerCase().includes(q));
  });

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Receipt size={20} color="#ef4444" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>GST Match Center</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Bank transaction vs GSTR reconciliation</p>
          </div>
        </div>
        <button onClick={() => qc.invalidate(["banking", "gst-match"])} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Stats */}
      {!isLoading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
          {[
            { label: "Total Entries", value: stats.total, color: "var(--text-primary)" },
            { label: "Matched", value: stats.matched, color: "#10b981" },
            { label: "Partial", value: stats.partial, color: "#818cf8" },
            { label: "Issues", value: stats.issues, color: "#ef4444" },
            { label: "Missing ITC", value: formatINR(stats.missingITC), color: "#f59e0b" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>{label}</p>
              <p style={{ fontSize: 18, fontWeight: 700, color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Health bar */}
      {!isLoading && stats.total > 0 && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>GST Compliance Health</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: healthPct >= 80 ? "#10b981" : healthPct >= 60 ? "#f59e0b" : "#ef4444" }}>{healthPct}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: "var(--bg-hover)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 4, background: healthPct >= 80 ? "#10b981" : healthPct >= 60 ? "#f59e0b" : "#ef4444", width: `${healthPct}%`, transition: "width 0.5s" }} />
          </div>
        </div>
      )}

      {/* Filters + Search */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendor, invoice, GSTIN…" style={{ width: "100%", fontSize: 12, padding: "7px 10px 7px 30px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[["all","All"],["MATCHED","Matched"],["PARTIAL","Partial"],["MISSING_INVOICE","Missing Invoice"],["MISSING_RETURN","Missing Return"]].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)} style={{ fontSize: 11, padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: filter === val ? "#6366f1" : "var(--bg-card)", color: filter === val ? "white" : "var(--text-secondary)", cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ height: 56, borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border)", opacity: 0.4 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 320, gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: "rgba(16,185,129,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Receipt size={26} color="#10b981" />
          </div>
          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
              {allMatches.length === 0 ? "No GST matches yet" : "No matches in this category"}
            </h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 360 }}>
              {allMatches.length === 0
                ? "GST matching runs automatically after each bank sync. Sync your accounts to generate match results."
                : "Try a different filter or clear the search."}
            </p>
          </div>
        </div>
      ) : (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Vendor / GSTIN", "GSTR Type", "Period", "Invoice", "Bank Amount", "GST Amount", "Status", "Confidence"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const cfg = MATCH_STYLES[m.matchStatus] ?? MATCH_STYLES.UNMATCHED;
                return (
                  <tr key={m.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{m.vendorName ?? "—"}</p>
                      {m.gstin && <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>{m.gstin}</p>}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)" }}>{m.gstrType ?? "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)" }}>{m.gstrPeriod ?? "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace" }}>{m.invoiceNumber ?? "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{formatINR(m.amount)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)" }}>{formatINR(m.gstAmount)}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: cfg.bg, color: cfg.text }}>
                        {cfg.icon} {cfg.label}
                      </span>
                      {m.issues && m.issues.length > 0 && (
                        <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3, maxWidth: 200 }}>{m.issues[0].description}</p>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {m.confidence !== null ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: Number(m.confidence) >= 80 ? "#10b981" : Number(m.confidence) >= 50 ? "#f59e0b" : "#ef4444" }}>
                          {Number(m.confidence).toFixed(0)}%
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
