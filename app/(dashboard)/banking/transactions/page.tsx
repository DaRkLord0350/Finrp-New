"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Search, Download, Tag, Link2, Flag, EyeOff,
  MoreHorizontal, X, SlidersHorizontal, RefreshCw,
  ArrowUpRight, ArrowDownRight, Loader2, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown,
} from "lucide-react";
import { useBankTransactions, type BankTransaction } from "@/hooks/useBankTransactions";
import { useBankAccounts } from "@/hooks/useBankAccounts";

const CATEGORIES = [
  "Customer Receipt", "Vendor Payment", "GST Payment", "TDS Payment",
  "Payroll", "Rent", "Utilities", "Bank Charges", "Interest Income",
  "Loan EMI", "Office Expense", "Travel", "Advertising", "Refund",
  "Staff Welfare", "Cloud & Software", "Raw Material", "Other",
];

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  UNREVIEWED: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b" },
  REVIEWED: { bg: "rgba(99,102,241,0.1)", text: "#818cf8" },
  CATEGORIZED: { bg: "rgba(6,182,212,0.1)", text: "#06b6d4" },
  MATCHED: { bg: "rgba(16,185,129,0.1)", text: "#10b981" },
  EXCLUDED: { bg: "rgba(100,116,139,0.1)", text: "#64748b" },
};

const RECONCILE_STYLES: Record<string, { bg: string; text: string }> = {
  UNMATCHED: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b" },
  MATCHED: { bg: "rgba(16,185,129,0.1)", text: "#10b981" },
  PARTIAL: { bg: "rgba(99,102,241,0.1)", text: "#818cf8" },
  DUPLICATE: { bg: "rgba(239,68,68,0.1)", text: "#ef4444" },
  EXCEPTION: { bg: "rgba(239,68,68,0.1)", text: "#ef4444" },
};

function formatINR(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}
type SortableColumn = "transactionDate" | "credit" | "debit" | "balance" | "createdAt";

type SortHeaderProps = {
  label: string;
  col: SortableColumn;
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (col: SortableColumn) => void;
  align?: "left" | "right" | "center";
};

function SortHeader({
  label,
  col,
  sortBy,
  sortDir,
  onSort,
  align = "left",
}: SortHeaderProps) {
  const active = sortBy === col;

  return (
    <th
      onClick={() => onSort(col)}
      style={{
        cursor: "pointer",
        padding: "10px 14px",
        textAlign: align,
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label}
        {active &&
          (sortDir === "asc" ? (
            <ChevronUp size={14} />
          ) : (
            <ChevronDown size={14} />
          ))}
      </span>
    </th>
  );
}

function PlainHeader({
  label,
  align = "left",
}: {
  label: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      style={{
        padding: "10px 14px",
        textAlign: align,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </th>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}

export default function TransactionsPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<BankTransaction | null>(null);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  const { accounts } = useBankAccounts();

  const {
    transactions, total, page, pages, isLoading, filters,
    updateFilters, updateTransaction, bulkCategorize, exportTransactions,
  } = useBankTransactions({ limit: 50 });

  // Honour a ?bankAccountId= deep link (e.g. from the Accounts page) on mount.
  useEffect(() => {
    const acc = new URLSearchParams(window.location.search).get("bankAccountId");
    if (acc) updateFilters({ bankAccountId: acc });
  }, [updateFilters]);

  const sortBy = filters.sortBy ?? "transactionDate";
  const sortDir = filters.sortDir ?? "desc";
  const toggleSort = useCallback((col: SortableColumn) => {
    updateFilters({ sortBy: col, sortDir: sortBy === col && sortDir === "desc" ? "asc" : "desc" });
  }, [sortBy, sortDir, updateFilters]);

  const allSelected = transactions.length > 0 && selected.length === transactions.length;
  const toggleAll = () => setSelected(allSelected ? [] : transactions.map(t => t.id));
  const toggleOne = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const handleBulkCategorize = useCallback(async () => {
    if (!bulkCategory || selected.length === 0) return;
    setBulkLoading(true);
    try {
      await bulkCategorize(selected, bulkCategory);
      setSelected([]);
      setBulkCategory("");
    } finally {
      setBulkLoading(false);
    }
  }, [bulkCategory, selected, bulkCategorize]);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Transaction Center</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {isLoading ? "Loading…" : `${total.toLocaleString()} transactions · ${transactions.filter(t => t.reconcileStatus === "UNMATCHED").length} unmatched on this page`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => updateFilters({ page: 1 })} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
            <RefreshCw size={12} /> Refresh
          </button>
          <button onClick={() => exportTransactions("csv")} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
            <Download size={12} /> Export CSV
          </button>
          <button onClick={() => exportTransactions("xlsx")} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
            <Download size={12} /> Export Excel
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 280, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}>
          <Search size={13} color="var(--text-muted)" />
          <input
            value={filters.q ?? ""}
            onChange={e => updateFilters({ q: e.target.value || undefined })}
            placeholder="Search narration, reference…"
            style={{ border: "none", outline: "none", fontSize: 13, background: "transparent", color: "var(--text-primary)", flex: 1 }}
          />
          {filters.q && <button onClick={() => updateFilters({ q: undefined })} style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}><X size={12} color="var(--text-muted)" /></button>}
        </div>

        <select
          value={filters.status ?? "all"}
          onChange={e => updateFilters({ status: e.target.value === "all" ? undefined : e.target.value })}
          style={{ fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}
        >
          <option value="all">All Status</option>
          <option value="UNREVIEWED">Unreviewed</option>
          <option value="REVIEWED">Reviewed</option>
          <option value="CATEGORIZED">Categorized</option>
          <option value="MATCHED">Matched</option>
          <option value="EXCLUDED">Excluded</option>
        </select>

        <select
          value={filters.reconcileStatus ?? "all"}
          onChange={e => updateFilters({ reconcileStatus: e.target.value === "all" ? undefined : e.target.value })}
          style={{ fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}
        >
          <option value="all">All Reconcile</option>
          <option value="UNMATCHED">Unmatched</option>
          <option value="MATCHED">Matched</option>
          <option value="PARTIAL">Partial</option>
          <option value="DUPLICATE">Duplicate</option>
          <option value="EXCEPTION">Exception</option>
        </select>

        <select
          value={filters.bankAccountId ?? "all"}
          onChange={e => updateFilters({ bankAccountId: e.target.value === "all" ? undefined : e.target.value })}
          style={{ fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}
        >
          <option value="all">All Banks</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.bankName} · {a.maskedNumber ?? a.accountNumber.slice(-4)}</option>)}
        </select>

        <button onClick={() => setShowFilters(!showFilters)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: showFilters ? "rgba(99,102,241,0.1)" : "var(--bg-card)", color: showFilters ? "#6366f1" : "var(--text-primary)", cursor: "pointer" }}>
          <SlidersHorizontal size={12} /> Filters
        </button>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "12px 14px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10 }}>
          <div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>From Date</p>
            <input type="date" value={filters.from ?? ""} onChange={e => updateFilters({ from: e.target.value || undefined })} style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>To Date</p>
            <input type="date" value={filters.to ?? ""} onChange={e => updateFilters({ to: e.target.value || undefined })} style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Category</p>
            <select value={filters.category ?? "all"} onChange={e => updateFilters({ category: e.target.value === "all" ? undefined : e.target.value })} style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <button onClick={() => updateFilters({ from: undefined, to: undefined, category: undefined, q: undefined, status: undefined, reconcileStatus: undefined, bankAccountId: undefined })} style={{ alignSelf: "flex-end", fontSize: 11, padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "#ef4444", cursor: "pointer" }}>
            Clear All
          </button>
        </div>
      )}

      {/* Bulk Actions */}
      {selected.length > 0 && (
        <div style={{ display: "flex", gap: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#818cf8", fontWeight: 600 }}>{selected.length} selected</span>
          <select value={bulkCategory} onChange={e => setBulkCategory(e.target.value)} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid rgba(99,102,241,0.3)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
            <option value="">Assign category…</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <button onClick={handleBulkCategorize} disabled={!bulkCategory || bulkLoading} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "4px 10px", borderRadius: 5, border: "none", background: "rgba(99,102,241,0.2)", color: "#818cf8", cursor: bulkCategory ? "pointer" : "not-allowed" }}>
            {bulkLoading ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : <Tag size={10} />}
            Categorize
          </button>
          <button onClick={() => setSelected([])} style={{ border: "none", background: "none", cursor: "pointer", padding: 2, marginLeft: "auto" }}><X size={12} color="#818cf8" /></button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", flex: 1 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
            <thead>
              <tr style={{ background: "var(--bg-hover)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "10px 14px", width: 36 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: "pointer" }} />
                </th>
                <SortHeader label="Date" col="transactionDate" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                <PlainHeader label="Narration / Reference" />
                <PlainHeader label="Bank" />
                <SortHeader label="Debit" col="debit" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} align="right" />
                <SortHeader label="Credit" col="credit" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} align="right" />
                <SortHeader label="Balance" col="balance" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} align="right" />
                <PlainHeader label="Category" />
                <PlainHeader label="Status" />
                <PlainHeader label="Reconcile" />
                <PlainHeader label="" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    {Array.from({ length: 11 }).map((_, j) => (
                      <td key={j} style={{ padding: "12px 14px" }}>
                        <div style={{ height: 12, borderRadius: 3, background: "var(--border)", opacity: 0.4, width: j === 1 ? "80%" : j === 3 || j === 4 || j === 5 ? "60%" : "40%" }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                    No transactions found. {accounts.length === 0 ? "Connect a bank account to get started." : "Try adjusting your filters."}
                  </td>
                </tr>
              ) : (
                transactions.map((txn, i) => {
                  const isSelected = selected.includes(txn.id);
                  const ss = STATUS_STYLES[txn.status] ?? STATUS_STYLES.UNREVIEWED;
                  const rs = RECONCILE_STYLES[txn.reconcileStatus] ?? RECONCILE_STYLES.UNMATCHED;
                  return (
                    <tr
                      key={txn.id}
                      style={{ borderBottom: i < transactions.length - 1 ? "1px solid var(--border)" : "none", background: isSelected ? "rgba(99,102,241,0.04)" : "transparent", cursor: "pointer" }}
                      onClick={() => setSelectedTxn(txn === selectedTxn ? null : txn)}
                    >
                      <td style={{ padding: "10px 14px" }} onClick={e => { e.stopPropagation(); toggleOne(txn.id); }}>
                        <input type="checkbox" checked={isSelected} onChange={() => { }} style={{ cursor: "pointer" }} />
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        <p style={{ color: "var(--text-primary)", fontWeight: 500 }}>{formatDate(txn.transactionDate)}</p>
                        {txn.valueDate && <p>{formatDate(txn.valueDate)}</p>}
                      </td>
                      <td style={{ padding: "10px 14px", maxWidth: 280 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {txn.isFlagged && <Flag size={9} color="#f59e0b" style={{ marginRight: 4, display: "inline" }} />}
                          {txn.isDuplicate && <span style={{ fontSize: 9, color: "#ef4444", fontWeight: 700, marginRight: 4 }}>DUP</span>}
                          {txn.narration}
                        </p>
                        <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{txn.txnType}{txn.referenceNumber ? ` · ${txn.referenceNumber}` : ""}</p>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-muted)" }}>
                        <p style={{ color: "var(--text-secondary)" }}>{txn.bankAccount.bankName}</p>
                        <p>{txn.bankAccount.accountNumber.slice(-4)}</p>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        {txn.debit ? <span style={{ fontSize: 13, fontWeight: 600, color: "#ef4444" }}>−{formatINR(txn.debit)}</span> : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        {txn.credit ? <span style={{ fontSize: 13, fontWeight: 600, color: "#10b981" }}>+{formatINR(txn.credit)}</span> : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        {txn.balance != null ? <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{formatINR(txn.balance)}</span> : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{txn.category ?? "—"}</span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap", background: ss.bg, color: ss.text }}>{txn.status}</span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap", background: rs.bg, color: rs.text }}>{txn.reconcileStatus}</span>
                      </td>
                      <td style={{ padding: "10px 14px" }} onClick={e => e.stopPropagation()}>
                        <TxnActionMenu txn={txn} onUpdate={updateTransaction} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Showing {((page - 1) * (filters.limit ?? 50)) + 1}–{Math.min(page * (filters.limit ?? 50), total)} of {total}
          </p>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => updateFilters({ page: page - 1 })} disabled={page <= 1} style={{ display: "flex", alignItems: "center", padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.4 : 1 }}>
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
              const p = page <= 4 ? i + 1 : page + i - 3;
              if (p > pages) return null;
              return (
                <button key={p} onClick={() => updateFilters({ page: p })} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: p === page ? "#6366f1" : "var(--bg-card)", color: p === page ? "white" : "var(--text-secondary)", cursor: "pointer", fontSize: 12, minWidth: 32 }}>{p}</button>
              );
            })}
            <button onClick={() => updateFilters({ page: page + 1 })} disabled={page >= pages} style={{ display: "flex", alignItems: "center", padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", cursor: page >= pages ? "not-allowed" : "pointer", opacity: page >= pages ? 0.4 : 1 }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selectedTxn && (
        <TransactionDetailDrawer
          txn={selectedTxn}
          onClose={() => setSelectedTxn(null)}
          onUpdate={updateTransaction}
        />
      )}
    </div>
  );
}

function TxnActionMenu({ txn, onUpdate }: { txn: BankTransaction; onUpdate: (id: string, u: Record<string, unknown>) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ padding: 4, borderRadius: 6, border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)" }}>
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "100%", zIndex: 20, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: 4, minWidth: 160, boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
          {[
            [<Link2 size={11} key="l" />, "Match to Invoice"],
            [<Tag size={11} key="t" />, "Categorize"],
            [<Flag size={11} key="f" />, txn.isFlagged ? "Remove Flag" : "Flag Transaction"],
            [<EyeOff size={11} key="e" />, "Exclude"],
          ].map(([icon, label]) => (
            <button
              key={String(label)}
              onClick={async () => {
                setOpen(false);
                if (String(label) === "Flag Transaction" || String(label) === "Remove Flag") {
                  await onUpdate(txn.id, { isFlagged: !txn.isFlagged });
                } else if (String(label) === "Exclude") {
                  await onUpdate(txn.id, { status: "EXCLUDED" });
                }
              }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 10px", fontSize: 12, border: "none", background: "none", cursor: "pointer", color: "var(--text-secondary)", borderRadius: 5, textAlign: "left" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              {icon as React.ReactNode} {label as string}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TransactionDetailDrawer({ txn, onClose, onUpdate }: {
  txn: BankTransaction;
  onClose: () => void;
  onUpdate: (id: string, u: Record<string, unknown>) => Promise<unknown>;
}) {
  const isCredit = txn.credit !== null && txn.credit > 0;
  const [category, setCategory] = useState(txn.category ?? "");
  const [notes, setNotes] = useState(txn.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(txn.id, { category: category || null, notes: notes || null, status: category ? "CATEGORIZED" : txn.status });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 360, background: "var(--bg-card)", borderLeft: "1px solid var(--border)", zIndex: 100, padding: 20, display: "flex", flexDirection: "column", gap: 16, boxShadow: "-4px 0 20px rgba(0,0,0,0.1)", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Transaction Detail</h3>
        <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><X size={16} color="var(--text-muted)" /></button>
      </div>

      <div style={{ background: isCredit ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${isCredit ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`, borderRadius: 10, padding: 16, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
          {isCredit ? <ArrowUpRight size={20} color="#10b981" /> : <ArrowDownRight size={20} color="#ef4444" />}
        </div>
        <p style={{ fontSize: 24, fontWeight: 700, color: isCredit ? "#10b981" : "#ef4444" }}>
          {isCredit ? "+" : "−"}{formatINR(isCredit ? (txn.credit ?? 0) : (txn.debit ?? 0))}
        </p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{isCredit ? "Credit" : "Debit"} · {formatDate(txn.transactionDate)}</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          ["Narration", txn.narration],
          ["Reference", txn.referenceNumber ?? "—"],
          ["Type", txn.txnType],
          ["Bank", `${txn.bankAccount.bankName} · …${txn.bankAccount.accountNumber.slice(-4)}`],
          ["Balance After", txn.balance != null ? formatINR(txn.balance) : "—"],
          ["Status", txn.status],
          ["Reconcile", txn.reconcileStatus],
        ].map(([l, v]) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{l}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", textAlign: "right", maxWidth: 200 }}>{v}</span>
          </div>
        ))}
      </div>

      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Assign Category</p>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: "100%", fontSize: 12, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
          <option value="">— Select category —</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Notes</p>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes…" style={{ width: "100%", fontSize: 12, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", resize: "vertical", minHeight: 64, outline: "none", boxSizing: "border-box" }} />
      </div>

      <button onClick={handleSave} disabled={saving} style={{ padding: "10px 0", borderRadius: 8, border: "none", background: "#6366f1", fontSize: 13, fontWeight: 600, color: "white", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}
