"use client";

import { useState, useMemo } from "react";
import {
  Search, Filter, Download, ChevronDown, ArrowUpRight, ArrowDownRight,
  Tag, SplitSquareHorizontal, FileText, Flag, EyeOff, Archive,
  CheckCircle2, MoreHorizontal, X, SlidersHorizontal, RefreshCw,
  Link2, Columns3,
} from "lucide-react";

interface Transaction {
  id: string;
  date: string;
  valueDate: string;
  narration: string;
  referenceNumber: string;
  credit: number | null;
  debit: number | null;
  balance: number;
  category: string;
  gstCategory: string;
  bank: string;
  accountNumber: string;
  status: string;
  reconcileStatus: string;
  txnType: string;
  isFlagged: boolean;
  isDuplicate: boolean;
  tags: string[];
}

const CATEGORIES = [
  "Customer Receipt", "Vendor Payment", "GST Payment", "TDS Payment",
  "Payroll", "Rent", "Utilities", "Bank Charges", "Interest Income",
  "Loan EMI", "Office Expense", "Travel", "Advertising", "Refund",
  "Staff Welfare", "Cloud & Software", "Raw Material", "Other",
];

const MOCK_TXN: Transaction[] = [
  { id: "1", date: "2026-06-10", valueDate: "2026-06-10", narration: "NEFT/Rajesh Traders Pvt Ltd/INV-2421/REF984512", referenceNumber: "REF984512", credit: 487500, debit: null, balance: 12400000, category: "Customer Receipt", gstCategory: "B2B_SALE", bank: "HDFC Bank", accountNumber: "XXXX4821", status: "UNREVIEWED", reconcileStatus: "UNMATCHED", txnType: "NEFT", isFlagged: false, isDuplicate: false, tags: [] },
  { id: "2", date: "2026-06-10", valueDate: "2026-06-10", narration: "UPI/Swiggy Business/FOOD-CORP-89/9876543210", referenceNumber: "UPI89321", credit: null, debit: 12400, balance: 11912500, category: "Staff Welfare", gstCategory: "B2B_PURCHASE", bank: "ICICI Bank", accountNumber: "XXXX9032", status: "CATEGORIZED", reconcileStatus: "UNMATCHED", txnType: "UPI", isFlagged: false, isDuplicate: false, tags: ["food"] },
  { id: "3", date: "2026-06-09", valueDate: "2026-06-09", narration: "NEFT/GST PMT-06/CGST+SGST/2025-26/June", referenceNumber: "GST202606", credit: null, debit: 184200, balance: 11900100, category: "GST Payment", gstCategory: "GST_PAYMENT", bank: "HDFC Bank", accountNumber: "XXXX4821", status: "CATEGORIZED", reconcileStatus: "MATCHED", txnType: "NEFT", isFlagged: false, isDuplicate: false, tags: ["gst"] },
  { id: "4", date: "2026-06-09", valueDate: "2026-06-09", narration: "RTGS/Amazon Web Services India Pvt Ltd/AWS-INV-2026-06", referenceNumber: "AWS202606", credit: null, debit: 56000, balance: 12715900, category: "Cloud & Software", gstCategory: "B2B_PURCHASE", bank: "Axis Bank", accountNumber: "XXXX7634", status: "CATEGORIZED", reconcileStatus: "MATCHED", txnType: "RTGS", isFlagged: false, isDuplicate: false, tags: ["aws", "software"] },
  { id: "5", date: "2026-06-08", valueDate: "2026-06-08", narration: "IMPS/SALARY JUNE 2026/PAYROLL BATCH/234 EMPLOYEES", referenceNumber: "PAY202606", credit: null, debit: 2340000, balance: 12771900, category: "Payroll", gstCategory: "EXEMPT", bank: "SBI", accountNumber: "XXXX1197", status: "MATCHED", reconcileStatus: "MATCHED", txnType: "IMPS", isFlagged: false, isDuplicate: false, tags: ["payroll"] },
  { id: "6", date: "2026-06-08", valueDate: "2026-06-08", narration: "NEFT/Sunrise Exports Ltd/EXP-1204/PAYMENT", referenceNumber: "SUN1204", credit: 924000, debit: null, balance: 15111900, category: "Customer Receipt", gstCategory: "EXPORT", bank: "HDFC Bank", accountNumber: "XXXX4821", status: "UNREVIEWED", reconcileStatus: "UNMATCHED", txnType: "NEFT", isFlagged: false, isDuplicate: false, tags: [] },
  { id: "7", date: "2026-06-07", valueDate: "2026-06-07", narration: "CHQ/Anand Steel Works/CHQ-009241", referenceNumber: "CHQ009241", credit: null, debit: 340000, balance: 14187900, category: "Raw Material", gstCategory: "B2B_PURCHASE", bank: "HDFC Bank", accountNumber: "XXXX4821", status: "REVIEWED", reconcileStatus: "PARTIAL", txnType: "CHEQUE", isFlagged: true, isDuplicate: false, tags: [] },
  { id: "8", date: "2026-06-07", valueDate: "2026-06-07", narration: "NEFT/TDS PAYMENT Q1/26AS/TDS-2026-07", referenceNumber: "TDS2026", credit: null, debit: 48000, balance: 14527900, category: "TDS Payment", gstCategory: "GST_PAYMENT", bank: "ICICI Bank", accountNumber: "XXXX9032", status: "MATCHED", reconcileStatus: "MATCHED", txnType: "NEFT", isFlagged: false, isDuplicate: false, tags: ["tds"] },
  { id: "9", date: "2026-06-06", valueDate: "2026-06-06", narration: "NEFT/Rajesh Traders Pvt Ltd/INV-2421/REF984512 DUPLICATE", referenceNumber: "REF984512DUP", credit: 487500, debit: null, balance: 14575900, category: "Customer Receipt", gstCategory: "B2B_SALE", bank: "HDFC Bank", accountNumber: "XXXX4821", status: "UNREVIEWED", reconcileStatus: "DUPLICATE", txnType: "NEFT", isFlagged: false, isDuplicate: true, tags: [] },
];

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  UNREVIEWED: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b" },
  REVIEWED:   { bg: "rgba(99,102,241,0.1)", text: "#818cf8" },
  CATEGORIZED:{ bg: "rgba(6,182,212,0.1)",  text: "#06b6d4" },
  MATCHED:    { bg: "rgba(16,185,129,0.1)", text: "#10b981" },
  EXCLUDED:   { bg: "rgba(100,116,139,0.1)", text: "#64748b" },
};

const RECONCILE_STYLES: Record<string, { bg: string; text: string }> = {
  UNMATCHED: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b" },
  MATCHED:   { bg: "rgba(16,185,129,0.1)", text: "#10b981" },
  PARTIAL:   { bg: "rgba(99,102,241,0.1)", text: "#818cf8" },
  DUPLICATE: { bg: "rgba(239,68,68,0.1)",  text: "#ef4444" },
  EXCEPTION: { bg: "rgba(239,68,68,0.1)",  text: "#ef4444" },
};

function formatINR(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [bankFilter, setBankFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);

  const filtered = useMemo(() =>
    MOCK_TXN.filter((t) => {
      const q = search.toLowerCase();
      if (q && !t.narration.toLowerCase().includes(q) && !t.referenceNumber.toLowerCase().includes(q)) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (bankFilter !== "all" && t.bank !== bankFilter) return false;
      return true;
    }), [search, categoryFilter, statusFilter, bankFilter]);

  const allSelected = filtered.length > 0 && selected.length === filtered.length;
  const toggleAll = () => setSelected(allSelected ? [] : filtered.map(t => t.id));
  const toggleOne = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Transaction Center</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{MOCK_TXN.length} transactions · {MOCK_TXN.filter(t => t.reconcileStatus === "UNMATCHED").length} unmatched</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
            <RefreshCw size={12} /> Refresh
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
            <Download size={12} /> Export
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 280, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search narration, reference..." style={{ border: "none", outline: "none", fontSize: 13, background: "transparent", color: "var(--text-primary)", flex: 1 }} />
          {search && <button onClick={() => setSearch("")} style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}><X size={12} color="var(--text-muted)" /></button>}
        </div>

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
          <option value="all">All Status</option>
          <option value="UNREVIEWED">Unreviewed</option>
          <option value="REVIEWED">Reviewed</option>
          <option value="CATEGORIZED">Categorized</option>
          <option value="MATCHED">Matched</option>
        </select>

        <select value={bankFilter} onChange={e => setBankFilter(e.target.value)} style={{ fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
          <option value="all">All Banks</option>
          <option value="HDFC Bank">HDFC Bank</option>
          <option value="ICICI Bank">ICICI Bank</option>
          <option value="SBI">SBI</option>
          <option value="Axis Bank">Axis Bank</option>
        </select>

        <button onClick={() => setShowFilters(!showFilters)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: showFilters ? "rgba(99,102,241,0.1)" : "var(--bg-card)", color: showFilters ? "#6366f1" : "var(--text-primary)", cursor: "pointer" }}>
          <SlidersHorizontal size={12} /> Advanced Filters
        </button>

        {selected.length > 0 && (
          <div style={{ display: "flex", gap: 6, padding: "4px 8px", borderRadius: 8, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
            <span style={{ fontSize: 12, color: "#818cf8", fontWeight: 600 }}>{selected.length} selected</span>
            {[["Categorize", <Tag size={10} />], ["Match", <Link2 size={10} />], ["Flag", <Flag size={10} />], ["Ignore", <EyeOff size={10} />]].map(([l, icon]) => (
              <button key={String(l)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "none", background: "rgba(99,102,241,0.15)", color: "#818cf8", cursor: "pointer" }}>
                {icon as React.ReactNode} {l as string}
              </button>
            ))}
            <button onClick={() => setSelected([])} style={{ border: "none", background: "none", cursor: "pointer", padding: 2 }}><X size={12} color="#818cf8" /></button>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", flex: 1 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
            <thead>
              <tr style={{ background: "var(--bg-hover)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "10px 14px", width: 36 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: "pointer" }} />
                </th>
                {["Date", "Narration / Reference", "Bank", "Debit", "Credit", "Balance", "Category", "Status", "Reconcile", ""].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((txn, i) => {
                const isSelected = selected.includes(txn.id);
                const ss = STATUS_STYLES[txn.status] ?? STATUS_STYLES.UNREVIEWED;
                const rs = RECONCILE_STYLES[txn.reconcileStatus] ?? RECONCILE_STYLES.UNMATCHED;
                return (
                  <tr
                    key={txn.id}
                    style={{
                      borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                      background: isSelected ? "rgba(99,102,241,0.04)" : "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedTxn(txn === selectedTxn ? null : txn)}
                  >
                    <td style={{ padding: "10px 14px" }} onClick={e => { e.stopPropagation(); toggleOne(txn.id); }}>
                      <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ cursor: "pointer" }} />
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      <p style={{ color: "var(--text-primary)", fontWeight: 500 }}>{txn.date}</p>
                      <p>{txn.valueDate}</p>
                    </td>
                    <td style={{ padding: "10px 14px", maxWidth: 280 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {txn.isFlagged && <Flag size={9} color="#f59e0b" style={{ marginRight: 4, display: "inline" }} />}
                        {txn.isDuplicate && <span style={{ fontSize: 9, color: "#ef4444", fontWeight: 700, marginRight: 4 }}>DUP</span>}
                        {txn.narration}
                      </p>
                      <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{txn.txnType} · {txn.referenceNumber}</p>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-muted)" }}>
                      <p style={{ color: "var(--text-secondary)" }}>{txn.bank}</p>
                      <p>{txn.accountNumber}</p>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      {txn.debit ? <span style={{ fontSize: 13, fontWeight: 600, color: "#ef4444" }}>−{formatINR(txn.debit)}</span> : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      {txn.credit ? <span style={{ fontSize: 13, fontWeight: 600, color: "#10b981" }}>+{formatINR(txn.credit)}</span> : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                      {formatINR(txn.balance)}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{txn.category}</span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap", background: ss.bg, color: ss.text }}>{txn.status}</span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap", background: rs.bg, color: rs.text }}>{txn.reconcileStatus}</span>
                    </td>
                    <td style={{ padding: "10px 14px" }} onClick={e => e.stopPropagation()}>
                      <ActionMenu txn={txn} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer */}
      {selectedTxn && (
        <TransactionDetailDrawer txn={selectedTxn} onClose={() => setSelectedTxn(null)} />
      )}
    </div>
  );
}

function ActionMenu({ txn }: { txn: Transaction }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ padding: 4, borderRadius: 6, border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)" }}>
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "100%", zIndex: 20, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: 4, minWidth: 170, boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
          {[
            [<Link2 size={11} />, "Match"],
            [<Tag size={11} />, "Categorize"],
            [<SplitSquareHorizontal size={11} />, "Split"],
            [<FileText size={11} />, "Create Journal"],
            [<Flag size={11} />, txn.isFlagged ? "Remove Flag" : "Flag"],
            [<EyeOff size={11} />, "Ignore"],
            [<Archive size={11} />, "Archive"],
          ].map(([icon, label]) => (
            <button key={String(label)} onClick={() => setOpen(false)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 10px", fontSize: 12, border: "none", background: "none", cursor: "pointer", color: "var(--text-secondary)", borderRadius: 5, textAlign: "left" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              {icon as React.ReactNode} {label as string}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TransactionDetailDrawer({ txn, onClose }: { txn: Transaction; onClose: () => void }) {
  const isCredit = txn.credit !== null;
  return (
    <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 360, background: "var(--bg-card)", borderLeft: "1px solid var(--border)", zIndex: 100, padding: 20, display: "flex", flexDirection: "column", gap: 16, boxShadow: "-4px 0 20px rgba(0,0,0,0.1)", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Transaction Detail</h3>
        <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}>
          <X size={16} color="var(--text-muted)" />
        </button>
      </div>

      {/* Amount Hero */}
      <div style={{ background: isCredit ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${isCredit ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`, borderRadius: 10, padding: "16px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
          {isCredit ? <ArrowUpRight size={20} color="#10b981" /> : <ArrowDownRight size={20} color="#ef4444" />}
        </div>
        <p style={{ fontSize: 24, fontWeight: 700, color: isCredit ? "#10b981" : "#ef4444" }}>
          {isCredit ? "+" : "−"}{formatINR(isCredit ? txn.credit! : txn.debit!)}
        </p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{isCredit ? "Credit" : "Debit"} on {txn.date}</p>
      </div>

      {/* Details Grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          ["Narration", txn.narration],
          ["Reference", txn.referenceNumber],
          ["Type", txn.txnType],
          ["Bank Account", `${txn.bank} · ${txn.accountNumber}`],
          ["Balance After", formatINR(txn.balance)],
          ["Category", txn.category],
          ["GST Category", txn.gstCategory],
          ["Status", txn.status],
          ["Reconcile", txn.reconcileStatus],
        ].map(([label, value]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", textAlign: "right", maxWidth: 200 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Category Assign */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Assign Category</p>
        <select defaultValue={txn.category} style={{ width: "100%", fontSize: 12, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Notes */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Notes</p>
        <textarea placeholder="Add notes..." style={{ width: "100%", fontSize: 12, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", resize: "vertical", minHeight: 64, outline: "none", boxSizing: "border-box" }} />
      </div>

      {/* Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button style={{ padding: "8px 0", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer", fontWeight: 500 }}>Match</button>
        <button style={{ padding: "8px 0", borderRadius: 8, border: "none", background: "#6366f1", fontSize: 12, color: "white", cursor: "pointer", fontWeight: 600 }}>Save Changes</button>
      </div>
    </div>
  );
}
