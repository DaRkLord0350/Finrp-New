"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, RefreshCw, Wallet, Download, ListTree, Table as TableIcon,
  CheckCircle2, XCircle,
} from "lucide-react";
import { SearchBar } from "@/components/ui/SearchBar";
import { Filters, type FilterField } from "@/components/ui/Filters";
import { Pagination } from "@/components/ui/Pagination";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import {
  useChartOfAccounts,
  useAccountOptions,
  type ChartAccount,
  type AccountListFilters,
  type AccountType,
} from "@/hooks/useChartOfAccounts";
import { ACCOUNT_TYPES } from "@/lib/validators/chart-of-accounts";
import { AccountsTable } from "./AccountsTable";
import { AccountTreeView } from "./AccountTreeView";
import { AccountFormModal } from "./AccountFormModal";

type ViewMode = "table" | "tree";

export default function ChartOfAccountsPage() {
  const { isMobile } = useBreakpoint();

  const [view, setView] = useState<ViewMode>("table");
  const [q, setQ] = useState("");
  const [type, setType] = useState<AccountType | "">("");
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const [sortBy, setSortBy] = useState<NonNullable<AccountListFilters["sortBy"]>>("code");
  const [sortDir, setSortDir] = useState<NonNullable<AccountListFilters["sortDir"]>>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartAccount | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filters: AccountListFilters = useMemo(
    () => ({ q: q || undefined, type: type || undefined, status, sortBy, sortDir, page, pageSize }),
    [q, type, status, sortBy, sortDir, page, pageSize]
  );

  const {
    accounts, total, loading, refetch,
    createAccount, updateAccount, deleteAccount, bulkUpdate,
  } = useChartOfAccounts(filters);
  const { options: parentOptions } = useAccountOptions(false);

  const activeCount = useMemo(() => accounts.filter((a) => a.isActive).length, [accounts]);
  const systemCount = useMemo(() => accounts.filter((a) => a.isSystemGenerated).length, [accounts]);

  const handleSortChange = (field: NonNullable<AccountListFilters["sortBy"]>) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(1);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const allSelected = accounts.length > 0 && accounts.every((a) => prev.has(a.id));
      if (allSelected) return new Set();
      return new Set(accounts.map((a) => a.id));
    });
  };

  const handleAddNew = () => { setEditingAccount(null); setShowForm(true); };
  const handleEdit = (account: ChartAccount) => { setEditingAccount(account); setShowForm(true); };
  const handleFormClose = () => { setShowForm(false); setEditingAccount(null); };

  const handleDelete = async (account: ChartAccount) => {
    if (!confirm(`Deactivate account "${account.code} — ${account.name}"? It can be reactivated later.`)) return;
    setActionError(null);
    try {
      await deleteAccount(account.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete account.");
    }
  };

  const handleToggleActive = async (account: ChartAccount) => {
    setActionError(null);
    try {
      await updateAccount(account.id, { isActive: !account.isActive });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update account status.");
    }
  };

  const handleBulkAction = async (action: "activate" | "deactivate") => {
    setActionError(null);
    try {
      const result = await bulkUpdate(Array.from(selectedIds), action);
      setSelectedIds(new Set());
      if (result.skipped > 0) alert(result.message);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Bulk action failed.");
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    params.set("status", status);
    window.open(`/api/chart-of-accounts/export?${params.toString()}`, "_blank");
  };

  const filterFields: FilterField[] = [
    {
      key: "type",
      label: "Type",
      type: "select",
      value: type || "all",
      options: ACCOUNT_TYPES.map((t) => ({ label: t, value: t })),
      onChange: (v) => { setType(v === "all" ? "" : (v as AccountType)); setPage(1); },
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      value: status,
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
        { label: "All", value: "all" },
      ],
      onChange: (v) => { setStatus(v as "active" | "inactive" | "all"); setPage(1); },
    },
  ];

  const handleClearFilters = () => {
    setType("");
    setStatus("active");
    setQ("");
    setPage(1);
  };

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: isMobile ? "flex-start" : "center",
          flexDirection: isMobile ? "column" : "row",
          justifyContent: "space-between",
          marginBottom: 28,
          gap: 14,
        }}
      >
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Chart of Accounts
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>
            Manage your organization&apos;s ledger accounts, hierarchy and balances.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={refetch} className="btn-ghost" style={{ padding: "8px 12px" }} title="Refresh">
            <RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
          </button>
          <button onClick={handleExport} className="btn-ghost" style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
            <Download size={15} />
            {isMobile ? "" : "Export"}
          </button>
          <button onClick={handleAddNew} className="btn-brand">
            <Plus size={15} />
            {isMobile ? "Add" : "Add Account"}
          </button>
        </div>
      </div>

      {actionError && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#ef4444", fontSize: 13, marginBottom: 20 }}>
          {actionError} — <button onClick={() => setActionError(null)} style={{ color: "#ef4444", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>Dismiss</button>
        </div>
      )}

      {/* Stats */}
      <div
        className="stagger"
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[
          { label: "Total Accounts", value: loading ? "—" : total, color: "#818cf8" },
          { label: "Active (this page)", value: loading ? "—" : activeCount, color: "#10b981" },
          { label: "System Generated", value: loading ? "—" : systemCount, color: "#f59e0b" },
          { label: "Selected", value: selectedIds.size, color: "#6366f1" },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            className="stat-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            style={{ padding: isMobile ? "14px 16px" : "20px 24px" }}
          >
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {stat.label}
            </p>
            <p style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: stat.color, marginTop: 6 }}>
              {stat.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Main surface */}
      <motion.div
        className="surface"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        style={{ overflow: "hidden" }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            justifyContent: "space-between",
            gap: 12,
            padding: isMobile ? "16px" : "20px 24px 16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Wallet size={16} color="var(--brand-400)" />
            </div>
            <div>
              <h3 className="section-title" style={{ fontSize: 15 }}>All Accounts</h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {total} account{total !== 1 ? "s" : ""} total
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: 3 }}>
            <button
              onClick={() => setView("table")}
              style={viewToggleStyle(view === "table")}
            >
              <TableIcon size={13} /> Table
            </button>
            <button
              onClick={() => setView("tree")}
              style={viewToggleStyle(view === "tree")}
            >
              <ListTree size={13} /> Hierarchy
            </button>
          </div>
        </div>

        {view === "table" && (
          <>
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                alignItems: isMobile ? "stretch" : "center",
                justifyContent: "space-between",
                gap: 12,
                padding: isMobile ? "12px 16px" : "14px 24px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <SearchBar
                placeholder="Search by code, name or description…"
                value={q}
                onChange={(v) => { setQ(v); setPage(1); }}
              />
              <Filters fields={filterFields} onClear={handleClearFilters} />
            </div>

            {selectedIds.size > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 24px",
                  background: "rgba(99,102,241,0.06)",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  flexWrap: "wrap",
                }}
              >
                <span>{selectedIds.size} account{selectedIds.size !== 1 ? "s" : ""} selected</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleBulkAction("activate")} className="btn-ghost" style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <CheckCircle2 size={13} /> Activate
                  </button>
                  <button onClick={() => handleBulkAction("deactivate")} className="btn-ghost" style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <XCircle size={13} /> Deactivate
                  </button>
                  <button onClick={() => setSelectedIds(new Set())} style={{ fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                    Clear
                  </button>
                </div>
              </div>
            )}

            <AccountsTable
              accounts={accounts}
              loading={loading}
              sortBy={sortBy}
              sortDir={sortDir}
              onSortChange={handleSortChange}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleActive={handleToggleActive}
            />

            {!loading && total > 0 && (
              <div style={{ padding: isMobile ? "12px 16px" : "14px 24px", borderTop: "1px solid var(--border)" }}>
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                />
              </div>
            )}
          </>
        )}

        {view === "tree" && <AccountTreeView />}
      </motion.div>

      {showForm && (
        <AccountFormModal
          account={editingAccount}
          parentOptions={parentOptions}
          onClose={handleFormClose}
          onCreate={createAccount}
          onUpdate={updateAccount}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function viewToggleStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 6,
    border: "none",
    background: active ? "var(--bg-card)" : "transparent",
    color: active ? "var(--text-primary)" : "var(--text-muted)",
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
    boxShadow: active ? "var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.08))" : "none",
  };
}
