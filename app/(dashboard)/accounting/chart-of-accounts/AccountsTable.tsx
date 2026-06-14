"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Trash2, Wallet, Power } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ChartAccount, AccountListFilters } from "@/hooks/useChartOfAccounts";

interface AccountsTableProps {
  accounts: ChartAccount[];
  loading: boolean;
  sortBy: AccountListFilters["sortBy"];
  sortDir: AccountListFilters["sortDir"];
  onSortChange: (field: NonNullable<AccountListFilters["sortBy"]>) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onEdit: (account: ChartAccount) => void;
  onDelete: (account: ChartAccount) => void;
  onToggleActive: (account: ChartAccount) => void;
}

const SORTABLE: { key: NonNullable<AccountListFilters["sortBy"]>; label: string }[] = [
  { key: "code", label: "Code" },
  { key: "name", label: "Account Name" },
  { key: "balance", label: "Balance" },
];

const HEADER_CELL: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--text-muted)",
  whiteSpace: "nowrap",
};

const CELL: React.CSSProperties = {
  padding: "12px",
  fontSize: 13,
  color: "var(--text-primary)",
  verticalAlign: "middle",
};

function formatCurrency(value: string | number): string {
  const n = Number(value);
  return n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown size={12} style={{ opacity: 0.4 }} />;
  return dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
}

export function AccountsTable({
  accounts, loading, sortBy, sortDir, onSortChange,
  selectedIds, onToggleSelect, onToggleSelectAll,
  onEdit, onDelete, onToggleActive,
}: AccountsTableProps) {
  const allSelected = accounts.length > 0 && accounts.every((a) => selectedIds.has(a.id));

  if (loading) {
    return (
      <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
        Loading accounts…
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "48px 24px", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <Wallet size={24} color="var(--brand-400)" />
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>No accounts found</p>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
          Try adjusting your search or filters, or add a new account.
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <th style={{ ...HEADER_CELL, width: 36 }}>
              <input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} aria-label="Select all accounts" />
            </th>
            {SORTABLE.map((col) => (
              <th key={col.key} style={HEADER_CELL}>
                <button
                  onClick={() => onSortChange(col.key)}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "inherit", font: "inherit", cursor: "pointer", padding: 0 }}
                >
                  {col.label}
                  <SortIcon active={sortBy === col.key} dir={sortDir ?? "asc"} />
                </button>
              </th>
            ))}
            <th style={HEADER_CELL}>Type</th>
            <th style={HEADER_CELL}>Subtype</th>
            <th style={HEADER_CELL}>Parent Account</th>
            <th style={{ ...HEADER_CELL, textAlign: "right" }}>Balance</th>
            <th style={HEADER_CELL}>Status</th>
            <th style={{ ...HEADER_CELL, textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <tr
              key={account.id}
              style={{ borderBottom: "1px solid var(--border)" }}
              onMouseOver={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = ""; }}
            >
              <td style={CELL}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(account.id)}
                  onChange={() => onToggleSelect(account.id)}
                  aria-label={`Select ${account.name}`}
                />
              </td>
              <td style={{ ...CELL, fontFamily: "var(--font-mono, monospace)", color: "var(--text-secondary)" }}>{account.code}</td>
              <td style={CELL}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{account.name}</span>
                  {account.isSystemGenerated && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--brand-400)", background: "rgba(99,102,241,0.12)", padding: "2px 7px", borderRadius: 20 }}>
                      System
                    </span>
                  )}
                  {account._count.children > 0 && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>({account._count.children} sub-accounts)</span>
                  )}
                </div>
              </td>
              <td style={{ ...CELL, color: "var(--text-secondary)" }}>{account.type}</td>
              <td style={{ ...CELL, color: "var(--text-secondary)" }}>{account.accountSubType ?? "—"}</td>
              <td style={{ ...CELL, color: "var(--text-secondary)" }}>
                {account.parentAccount ? `${account.parentAccount.code} — ${account.parentAccount.name}` : "—"}
              </td>
              <td style={{ ...CELL, textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                {formatCurrency(account.balance)}
              </td>
              <td style={CELL}>
                <StatusBadge status={account.isActive ? "active" : "inactive"} />
              </td>
              <td style={{ ...CELL, textAlign: "right" }}>
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  <button
                    onClick={() => onEdit(account)}
                    title="Edit account"
                    style={iconBtnStyle}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => onToggleActive(account)}
                    title={account.isActive ? "Deactivate" : "Activate"}
                    disabled={account.isSystemGenerated && account.isActive}
                    style={{ ...iconBtnStyle, opacity: account.isSystemGenerated && account.isActive ? 0.4 : 1 }}
                  >
                    <Power size={14} />
                  </button>
                  <button
                    onClick={() => onDelete(account)}
                    title="Delete account"
                    disabled={account.isSystemGenerated}
                    style={{ ...iconBtnStyle, color: account.isSystemGenerated ? "var(--text-muted)" : "#ef4444", opacity: account.isSystemGenerated ? 0.4 : 1 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  color: "var(--text-secondary)",
  cursor: "pointer",
};
