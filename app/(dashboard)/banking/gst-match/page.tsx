"use client";

import { useState } from "react";
import { Receipt, CheckCircle2, AlertTriangle, XCircle, TrendingUp, Shield, Link2, FileText, Search, Filter } from "lucide-react";

const GST_MATCHES = [
  { id: "1", bankDate: "09 Jun", narration: "GST PMT-06/CGST+SGST", bankAmount: 184200, gstrType: "GSTR-3B", gstrPeriod: "Jun 2026", invoiceNumber: "GST-JUN-26", gstin: "27AABCU9603R1ZP", gstAmount: 184200, matchStatus: "MATCHED", confidence: 99 },
  { id: "2", bankDate: "10 Jun", narration: "NEFT/Rajesh Traders/INV-2421", bankAmount: 487500, gstrType: "GSTR-1", gstrPeriod: "Jun 2026", invoiceNumber: "INV-2421", gstin: "29AAACR5055K1Z5", gstAmount: 74389, matchStatus: "PARTIAL", confidence: 78, issues: [{ type: "AMOUNT_MISMATCH", description: "Bank amount ₹4.87L but invoice total ₹4.13L + GST ₹74K = ₹4.87L — check IGST split" }] },
  { id: "3", bankDate: "08 Jun", narration: "NEFT/Sunrise Exports Ltd", bankAmount: 924000, gstrType: "GSTR-1", gstrPeriod: "Jun 2026", invoiceNumber: "EXP-1204", gstin: "27AAHCS1730D1ZK", gstAmount: null, matchStatus: "MISSING_RETURN", confidence: 0, issues: [{ type: "MISSING_RETURN", description: "Bank payment received but no corresponding GSTR-1 entry found for this GSTIN" }] },
  { id: "4", bankDate: "07 Jun", narration: "UPI/Vendor Payment/ABC Corp", bankAmount: 236000, gstrType: "GSTR-2B", gstrPeriod: "Jun 2026", invoiceNumber: null, gstin: "27AABCA1234Z1Z5", gstAmount: 36000, matchStatus: "MISSING_INVOICE", confidence: 30, issues: [{ type: "MISSING_INVOICE", description: "Payment recorded but no purchase invoice found. Potential missing ITC of ₹36,000." }] },
  { id: "5", bankDate: "07 Jun", narration: "RTGS/AWS India", bankAmount: 56000, gstrType: "GSTR-2B", gstrPeriod: "Jun 2026", invoiceNumber: "AWS-INV-2026-06", gstin: "27AABCA1234Z1Z6", gstAmount: 10123, matchStatus: "MATCHED", confidence: 96 },
];

const MATCH_STYLES: Record<string, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
  MATCHED:         { bg: "rgba(16,185,129,0.1)",   text: "#10b981", label: "Matched",         icon: <CheckCircle2 size={10} /> },
  PARTIAL:         { bg: "rgba(99,102,241,0.1)",   text: "#818cf8", label: "Partial",         icon: <AlertTriangle size={10} /> },
  MISSING_RETURN:  { bg: "rgba(239,68,68,0.1)",    text: "#ef4444", label: "Missing Return",  icon: <XCircle size={10} /> },
  MISSING_INVOICE: { bg: "rgba(245,158,11,0.1)",   text: "#f59e0b", label: "Missing Invoice", icon: <AlertTriangle size={10} /> },
  MISMATCH:        { bg: "rgba(239,68,68,0.1)",    text: "#ef4444", label: "Mismatch",        icon: <XCircle size={10} /> },
};

function formatINR(n: number | null) {
  if (!n) return "—";
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function GSTMatchPage() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = GST_MATCHES.filter(m => {
    if (filter !== "all" && m.matchStatus !== filter) return false;
    if (search && !m.narration.toLowerCase().includes(search.toLowerCase()) && !m.invoiceNumber?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: GST_MATCHES.length,
    matched: GST_MATCHES.filter(m => m.matchStatus === "MATCHED").length,
    issues: GST_MATCHES.filter(m => m.matchStatus !== "MATCHED").length,
    missingITC: GST_MATCHES.filter(m => m.matchStatus === "MISSING_INVOICE").reduce((s, m) => s + (m.gstAmount ?? 0), 0),
  };
  const healthPct = Math.round((stats.matched / stats.total) * 100);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>GST Match Center</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Bank transactions ↔ GST returns reconciliation for ITC accuracy</p>
      </div>

      {/* Score Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "GST Health Score", value: `${healthPct}%`, color: healthPct >= 80 ? "#10b981" : "#f59e0b", icon: <Shield size={14} color={healthPct >= 80 ? "#10b981" : "#f59e0b"} /> },
          { label: "Matched Records", value: stats.matched, color: "#10b981", icon: <CheckCircle2 size={14} color="#10b981" /> },
          { label: "Issues Found", value: stats.issues, color: "#ef4444", icon: <AlertTriangle size={14} color="#ef4444" /> },
          { label: "Potential Missing ITC", value: formatINR(stats.missingITC), color: "#f59e0b", icon: <Receipt size={14} color="#f59e0b" /> },
        ].map((card) => (
          <div key={card.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${card.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>{card.icon}</div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>{card.label}</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: card.color }}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, maxWidth: 320, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px" }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions..." style={{ border: "none", outline: "none", fontSize: 13, background: "transparent", color: "var(--text-primary)", flex: 1 }} />
        </div>
        {["all", "MATCHED", "PARTIAL", "MISSING_RETURN", "MISSING_INVOICE"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ fontSize: 11, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: filter === f ? "#6366f1" : "var(--bg-card)", color: filter === f ? "white" : "var(--text-secondary)", cursor: "pointer" }}>
            {f === "all" ? "All" : MATCH_STYLES[f]?.label ?? f}
          </button>
        ))}
      </div>

      {/* Match Table */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--bg-hover)", borderBottom: "1px solid var(--border)" }}>
              {["Bank Transaction", "Amount", "GSTR Type", "Period", "Invoice / GSTIN", "GST Amount", "Status", "Confidence"].map(h => (
                <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((m, i) => {
              const s = MATCH_STYLES[m.matchStatus] ?? MATCH_STYLES.PARTIAL;
              return (
                <>
                  <tr key={m.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 14px" }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{m.narration}</p>
                      <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{m.bankDate}</p>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: "#10b981" }}>{formatINR(m.bankAmount)}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-secondary)" }}>{m.gstrType}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-secondary)" }}>{m.gstrPeriod}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <p style={{ fontSize: 12, color: "var(--text-primary)" }}>{m.invoiceNumber ?? "—"}</p>
                      {m.gstin && <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{m.gstin}</p>}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: "#6366f1" }}>{formatINR(m.gstAmount)}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 5, background: s.bg, color: s.text, width: "fit-content" }}>
                        {s.icon} {s.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 48, height: 4, borderRadius: 4, background: "var(--border)" }}>
                          <div style={{ width: `${m.confidence}%`, height: 4, borderRadius: 4, background: m.confidence >= 80 ? "#10b981" : m.confidence >= 50 ? "#f59e0b" : "#ef4444" }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: m.confidence >= 80 ? "#10b981" : m.confidence >= 50 ? "#f59e0b" : "#ef4444" }}>{m.confidence}%</span>
                      </div>
                    </td>
                  </tr>
                  {m.issues && m.issues.length > 0 && (
                    <tr key={`${m.id}-issues`} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td colSpan={8} style={{ padding: "0 14px 10px 14px" }}>
                        {m.issues.map((issue, j) => (
                          <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "6px 10px", borderRadius: 6, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                            <AlertTriangle size={11} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                            <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>{issue.description}</p>
                          </div>
                        ))}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ITC Summary */}
      <div style={{ background: "var(--bg-card)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <AlertTriangle size={14} color="#f59e0b" />
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b" }}>ITC Risk Summary</h3>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            ["Missing ITC Exposure", formatINR(stats.missingITC), "#ef4444"],
            ["Records Requiring Review", stats.issues, "#f59e0b"],
            ["GSTR-2B Match Rate", `${healthPct}%`, healthPct >= 80 ? "#10b981" : "#f59e0b"],
          ].map(([label, value, color]) => (
            <div key={String(label)}>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: String(color) }}>{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
