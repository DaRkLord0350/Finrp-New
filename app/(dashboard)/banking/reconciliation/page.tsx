"use client";

import { useState } from "react";
import {
  GitMerge, ChevronRight, Check, X, AlertTriangle, Plus,
  RotateCcw, Zap, Search, Filter, CheckCircle2, Circle,
  ArrowLeftRight, SplitSquareHorizontal, Merge,
} from "lucide-react";

interface BankTxn {
  id: string; date: string; narration: string; amount: number; type: "credit" | "debit";
  reconcileStatus: string; balance: number; reference: string;
}
interface LedgerEntry {
  id: string; date: string; description: string; amount: number; type: "debit" | "credit";
  reference: string; account: string; status: string;
}

const BANK_TXNS: BankTxn[] = [
  { id: "b1", date: "10 Jun", narration: "NEFT/Rajesh Traders/INV-2421", amount: 487500, type: "credit", reconcileStatus: "UNMATCHED", balance: 12400000, reference: "REF984512" },
  { id: "b2", date: "09 Jun", narration: "GST PMT-06/CGST+SGST", amount: 184200, type: "debit", reconcileStatus: "MATCHED", balance: 11900100, reference: "GST202606" },
  { id: "b3", date: "08 Jun", narration: "IMPS/Salary June 2026", amount: 2340000, type: "debit", reconcileStatus: "MATCHED", balance: 14187900, reference: "PAY202606" },
  { id: "b4", date: "08 Jun", narration: "NEFT/Sunrise Exports Ltd", amount: 924000, type: "credit", reconcileStatus: "UNMATCHED", balance: 15111900, reference: "SUN1204" },
  { id: "b5", date: "07 Jun", narration: "CHQ/Anand Steel Works/009241", amount: 340000, type: "debit", reconcileStatus: "PARTIAL", balance: 14527900, reference: "CHQ009241" },
  { id: "b6", date: "06 Jun", narration: "UPI/Cloud Infra Pvt Ltd", amount: 89000, type: "debit", reconcileStatus: "UNMATCHED", balance: 14867900, reference: "UPI34521" },
];

const LEDGER_ENTRIES: LedgerEntry[] = [
  { id: "l1", date: "10 Jun", description: "Invoice INV-2421 Payment — Rajesh Traders", amount: 487500, type: "credit", reference: "INV-2421", account: "Accounts Receivable", status: "UNMATCHED" },
  { id: "l2", date: "09 Jun", description: "GST Payment June 2026 — CGST+SGST", amount: 184200, type: "debit", reference: "GST-JUN-26", account: "GST Payable", status: "MATCHED" },
  { id: "l3", date: "08 Jun", description: "Payroll June 2026 — 234 Employees", amount: 2340000, type: "debit", reference: "PAY-JUN-26", account: "Salaries Payable", status: "MATCHED" },
  { id: "l4", date: "08 Jun", description: "Invoice EXP-1204 — Sunrise Exports Ltd", amount: 924000, type: "credit", reference: "EXP-1204", account: "Accounts Receivable", status: "UNMATCHED" },
  { id: "l5", date: "07 Jun", description: "Purchase PO-9241 — Anand Steel Works", amount: 340000, type: "debit", reference: "PO-9241", account: "Accounts Payable", status: "PARTIAL" },
  { id: "l6", date: "06 Jun", description: "Cloud Infrastructure June 2026", amount: 89000, type: "debit", reference: "EXP-CLOUD-06", account: "Cloud Expenses", status: "UNMATCHED" },
];

function formatINR(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

const STATUS_COLORS: Record<string, string> = {
  MATCHED: "#10b981", UNMATCHED: "#f59e0b", PARTIAL: "#6366f1", EXCEPTION: "#ef4444",
};

export default function ReconciliationPage() {
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [selectedLedger, setSelectedLedger] = useState<string | null>(null);
  const [matches, setMatches] = useState<Array<{ bankId: string; ledgerId: string }>>([]);
  const [searchBank, setSearchBank] = useState("");
  const [searchLedger, setSearchLedger] = useState("");
  const [filter, setFilter] = useState("all");

  const bankTxn = BANK_TXNS.find(b => b.id === selectedBank);
  const ledgerEntry = LEDGER_ENTRIES.find(l => l.id === selectedLedger);
  const canMatch = selectedBank && selectedLedger && bankTxn && ledgerEntry &&
    Math.abs(bankTxn.amount - ledgerEntry.amount) < 1;

  const handleMatch = () => {
    if (!selectedBank || !selectedLedger) return;
    setMatches(m => [...m, { bankId: selectedBank, ledgerId: selectedLedger }]);
    setSelectedBank(null);
    setSelectedLedger(null);
  };

  const stats = {
    total: BANK_TXNS.length,
    matched: BANK_TXNS.filter(b => b.reconcileStatus === "MATCHED").length + matches.length,
    unmatched: BANK_TXNS.filter(b => b.reconcileStatus === "UNMATCHED").length,
    partial: BANK_TXNS.filter(b => b.reconcileStatus === "PARTIAL").length,
  };
  const pct = Math.round((stats.matched / stats.total) * 100);

  const filteredBank = BANK_TXNS.filter(t => {
    if (searchBank && !t.narration.toLowerCase().includes(searchBank.toLowerCase())) return false;
    if (filter !== "all" && t.reconcileStatus !== filter) return false;
    return true;
  });
  const filteredLedger = LEDGER_ENTRIES.filter(t =>
    !searchLedger || t.description.toLowerCase().includes(searchLedger.toLowerCase())
  );

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Reconciliation Center</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Match bank transactions to ledger entries</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(99,102,241,0.08)", color: "#6366f1", cursor: "pointer", fontWeight: 600 }}>
            <Zap size={12} /> Auto-Match
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "white", cursor: "pointer", fontWeight: 600 }}>
            <CheckCircle2 size={12} /> Complete Session
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 20 }}>
            {[
              ["Matched", stats.matched, "#10b981"],
              ["Unmatched", stats.unmatched, "#f59e0b"],
              ["Partial", stats.partial, "#6366f1"],
              ["Total", stats.total, "var(--text-secondary)"],
            ].map(([l, v, c]) => (
              <div key={String(l)}>
                <p style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>{l}</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: String(c) }}>{v}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 28, fontWeight: 700, color: pct >= 80 ? "#10b981" : "#f59e0b" }}>{pct}%</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Reconciled</p>
          </div>
        </div>
        <div style={{ height: 8, borderRadius: 8, background: "var(--border)", overflow: "hidden" }}>
          <div style={{ height: 8, background: "linear-gradient(90deg, #10b981, #6366f1)", width: `${pct}%`, borderRadius: 8, transition: "width 0.5s ease" }} />
        </div>
      </div>

      {/* Split Panel Workspace */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 1fr", gap: 0, flex: 1, minHeight: 400 }}>

        {/* Left: Bank Transactions */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px 0 0 12px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Bank Transactions</h3>
              <div style={{ display: "flex", gap: 4 }}>
                {["all", "UNMATCHED", "PARTIAL"].map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, border: "1px solid var(--border)", background: filter === f ? "#6366f1" : "var(--bg-card)", color: filter === f ? "white" : "var(--text-muted)", cursor: "pointer" }}>{f === "all" ? "All" : f}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-hover)", borderRadius: 6, padding: "5px 8px" }}>
              <Search size={11} color="var(--text-muted)" />
              <input value={searchBank} onChange={e => setSearchBank(e.target.value)} placeholder="Search..." style={{ border: "none", outline: "none", fontSize: 11, background: "transparent", color: "var(--text-primary)", flex: 1 }} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filteredBank.map((txn) => {
              const isMatched = matches.some(m => m.bankId === txn.id) || txn.reconcileStatus === "MATCHED";
              const isSelected = selectedBank === txn.id;
              return (
                <div
                  key={txn.id}
                  onClick={() => !isMatched && setSelectedBank(isSelected ? null : txn.id)}
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--border)",
                    cursor: isMatched ? "default" : "pointer",
                    background: isSelected ? "rgba(99,102,241,0.08)" : "transparent",
                    borderLeft: `3px solid ${isMatched ? "#10b981" : isSelected ? "#6366f1" : "transparent"}`,
                    opacity: isMatched ? 0.7 : 1,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{txn.narration}</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: txn.type === "credit" ? "#10b981" : "#ef4444", flexShrink: 0 }}>
                      {txn.type === "credit" ? "+" : "−"}{formatINR(txn.amount)}
                    </p>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{txn.date} · {txn.reference}</p>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: `${STATUS_COLORS[isMatched ? "MATCHED" : txn.reconcileStatus]}20`, color: STATUS_COLORS[isMatched ? "MATCHED" : txn.reconcileStatus] }}>
                      {isMatched ? "MATCHED" : txn.reconcileStatus}
                    </span>
                  </div>
                  {isSelected && <div style={{ marginTop: 6 }}><span style={{ fontSize: 10, color: "#6366f1", fontWeight: 600 }}>Selected — pick a ledger entry to match</span></div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Center: Match Controls */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--bg-hover)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "0 8px" }}>
          <ArrowLeftRight size={14} color="var(--text-muted)" />
          {canMatch ? (
            <button
              onClick={handleMatch}
              style={{ width: 48, height: 48, borderRadius: "50%", border: "none", background: "#10b981", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 12px rgba(16,185,129,0.4)" }}
              title="Confirm Match"
            >
              <Check size={18} color="white" strokeWidth={2.5} />
            </button>
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4 }}>
              <Check size={18} color="var(--text-muted)" />
            </div>
          )}
          <button style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--bg-card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="Split">
            <SplitSquareHorizontal size={12} color="var(--text-muted)" />
          </button>
          <button style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--bg-card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="Merge">
            <Merge size={12} color="var(--text-muted)" />
          </button>
          <button style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--bg-card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="Undo">
            <RotateCcw size={12} color="var(--text-muted)" />
          </button>
          {(selectedBank || selectedLedger) && (
            <button onClick={() => { setSelectedBank(null); setSelectedLedger(null); }} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="Clear">
              <X size={12} color="#ef4444" />
            </button>
          )}
          {canMatch && (
            <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 6, padding: "4px 6px", textAlign: "center" }}>
              <p style={{ fontSize: 9, color: "#10b981", fontWeight: 700 }}>EXACT</p>
              <p style={{ fontSize: 9, color: "#10b981" }}>MATCH</p>
            </div>
          )}
        </div>

        {/* Right: Ledger Entries */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "0 12px 12px 0", borderLeft: "none", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Ledger Entries</h3>
              <button style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", cursor: "pointer" }}>
                + Create Entry
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-hover)", borderRadius: 6, padding: "5px 8px" }}>
              <Search size={11} color="var(--text-muted)" />
              <input value={searchLedger} onChange={e => setSearchLedger(e.target.value)} placeholder="Search..." style={{ border: "none", outline: "none", fontSize: 11, background: "transparent", color: "var(--text-primary)", flex: 1 }} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filteredLedger.map((entry) => {
              const isMatched = matches.some(m => m.ledgerId === entry.id) || entry.status === "MATCHED";
              const isSelected = selectedLedger === entry.id;
              const bankTxnSelected = BANK_TXNS.find(b => b.id === selectedBank);
              const amountMatch = bankTxnSelected && Math.abs(bankTxnSelected.amount - entry.amount) < 1;
              return (
                <div
                  key={entry.id}
                  onClick={() => !isMatched && setSelectedLedger(isSelected ? null : entry.id)}
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--border)",
                    cursor: isMatched ? "default" : "pointer",
                    background: isSelected ? "rgba(99,102,241,0.08)" : amountMatch && !isMatched ? "rgba(16,185,129,0.04)" : "transparent",
                    borderLeft: `3px solid ${isMatched ? "#10b981" : isSelected ? "#6366f1" : amountMatch && !isMatched ? "#10b981" : "transparent"}`,
                    opacity: isMatched ? 0.7 : 1,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{entry.description}</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: entry.type === "credit" ? "#10b981" : "#ef4444", flexShrink: 0 }}>
                      {entry.type === "credit" ? "+" : "−"}{formatINR(entry.amount)}
                    </p>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{entry.date} · {entry.account}</p>
                    {amountMatch && !isMatched && selectedBank && (
                      <span style={{ fontSize: 9, color: "#10b981", fontWeight: 700 }}>AMOUNT MATCH</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Matched Pairs */}
      {matches.length > 0 && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>Matched in this Session ({matches.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {matches.map((m, i) => {
              const b = BANK_TXNS.find(t => t.id === m.bankId);
              const l = LEDGER_ENTRIES.find(e => e.id === m.ledgerId);
              if (!b || !l) return null;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
                  <CheckCircle2 size={12} color="#10b981" />
                  <span style={{ fontSize: 11, flex: 1, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.narration}</span>
                  <ArrowLeftRight size={10} color="var(--text-muted)" />
                  <span style={{ fontSize: 11, flex: 1, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.description}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#10b981" }}>{formatINR(b.amount)}</span>
                  <button onClick={() => setMatches(prev => prev.filter((_, j) => j !== i))} style={{ border: "none", background: "none", cursor: "pointer", padding: 2 }}>
                    <X size={10} color="var(--text-muted)" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
