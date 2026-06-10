"use client";

import { useState } from "react";
import {
  Plus, Search, RefreshCw, MoreHorizontal, Eye, Download, Plug2,
  Wifi, WifiOff, Clock, TrendingUp, TrendingDown, CheckCircle2,
  XCircle, AlertTriangle, Building2, KeyRound, Loader2, X,
} from "lucide-react";
import { useBankAccounts, type BankAccount } from "@/hooks/useBankAccounts";
import { useBankSync } from "@/hooks/useBankSync";

function formatINR(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toFixed(0)}`;
}

function formatTimeAgo(dateStr: string | null) {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ConsentBadge({ status }: { status: string | null }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    ACTIVE:   { bg: "rgba(16,185,129,0.12)",  text: "#10b981", label: "Active" },
    EXPIRED:  { bg: "rgba(239,68,68,0.12)",   text: "#ef4444", label: "Expired" },
    EXPIRING: { bg: "rgba(245,158,11,0.12)",  text: "#f59e0b", label: "Expiring" },
    REVOKED:  { bg: "rgba(239,68,68,0.12)",   text: "#ef4444", label: "Revoked" },
    NONE:     { bg: "rgba(100,116,139,0.12)", text: "#64748b", label: "None" },
  };
  const s = styles[status ?? "NONE"] ?? styles.NONE;
  return <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: s.bg, color: s.text }}>{s.label}</span>;
}

function SyncBadge({ status }: { status: string | null }) {
  if (!status) return <span style={{ fontSize: 10, color: "var(--text-muted)" }}>—</span>;
  const map: Record<string, { c: string; icon: React.ReactNode }> = {
    SUCCESS: { c: "#10b981", icon: <CheckCircle2 size={10} /> },
    FAILED:  { c: "#ef4444", icon: <XCircle size={10} /> },
    PARTIAL: { c: "#f59e0b", icon: <AlertTriangle size={10} /> },
  };
  const s = map[status] ?? map.PARTIAL;
  return <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: s.c }}>{s.icon} {status}</span>;
}

function HealthBar({ score }: { score: number | null }) {
  const s = score ?? 0;
  const c = s >= 90 ? "#10b981" : s >= 70 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 60, height: 4, borderRadius: 4, background: "var(--border)" }}>
        <div style={{ width: `${s}%`, height: 4, borderRadius: 4, background: c }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: c }}>{s}</span>
    </div>
  );
}

function AddAccountModal({ onClose, onConnectSetu, onManualAdd }: {
  onClose: () => void;
  onConnectSetu: () => void;
  onManualAdd: (data: { accountName: string; bankName: string; accountNumber: string; ifscCode: string; accountType: string; openingBalance: number }) => Promise<void>;
}) {
  const [mode, setMode] = useState<"choose" | "manual">("choose");
  const [form, setForm] = useState({ accountName: "", bankName: "", accountNumber: "", ifscCode: "", accountType: "CURRENT", openingBalance: "" });
  const [saving, setSaving] = useState(false);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.accountName || !form.bankName || !form.accountNumber) return;
    setSaving(true);
    try {
      await onManualAdd({ ...form, openingBalance: Number(form.openingBalance) || 0 });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, width: 440, maxWidth: "calc(100vw - 32px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
            {mode === "choose" ? "Add Bank Account" : "Add Manually"}
          </h3>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><X size={16} color="var(--text-muted)" /></button>
        </div>

        {mode === "choose" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button onClick={onConnectSetu} style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-hover)", cursor: "pointer", textAlign: "left" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "#6366f1")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Plug2 size={20} color="#6366f1" />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Connect via Setu AA</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>RBI-regulated Account Aggregator — fastest, most secure</p>
              </div>
            </button>
            <button onClick={() => setMode("manual")} style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-hover)", cursor: "pointer", textAlign: "left" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "#6366f1")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(16,185,129,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Building2 size={20} color="#10b981" />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Add Manually</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Enter account details manually, then import statements</p>
              </div>
            </button>
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Account Name", key: "accountName", placeholder: "e.g. Primary Current Account" },
              { label: "Bank Name", key: "bankName", placeholder: "e.g. HDFC Bank" },
              { label: "Account Number", key: "accountNumber", placeholder: "Full account number" },
              { label: "IFSC Code", key: "ifscCode", placeholder: "e.g. HDFC0001234" },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>{label}</label>
                <input
                  value={(form as Record<string, string>)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }}
                />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Account Type</label>
              <select value={form.accountType} onChange={e => setForm(f => ({ ...f, accountType: e.target.value }))} style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
                {["CURRENT", "SAVINGS", "CASH_CREDIT", "OVERDRAFT", "FIXED_DEPOSIT"].map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Opening Balance (₹)</label>
              <input type="number" value={form.openingBalance} onChange={e => setForm(f => ({ ...f, openingBalance: e.target.value }))} placeholder="0" style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button type="button" onClick={() => setMode("choose")} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>Back</button>
              <button type="submit" disabled={saving} style={{ flex: 2, padding: "9px 0", borderRadius: 8, border: "none", background: "#6366f1", fontSize: 13, fontWeight: 600, color: "white", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : "Add Account"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function BankAccountsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [showAddModal, setShowAddModal] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const { accounts, isLoading, totalBalance, refresh, triggerSync, deleteAccount } = useBankAccounts();
  const { connectSetu } = useBankSync();

  const activeAccounts = accounts.filter(a => a.isActive);

  const filtered = accounts.filter(a => {
    const q = search.toLowerCase();
    if (q && !a.bankName.toLowerCase().includes(q) && !a.accountName.toLowerCase().includes(q)) return false;
    if (filter === "active" && !a.isActive) return false;
    if (filter === "inactive" && a.isActive) return false;
    if (filter === "expiring" && a.consentStatus !== "EXPIRING" && a.consentStatus !== "EXPIRED") return false;
    return true;
  });

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try { await triggerSync(id); }
    finally { setSyncingId(null); }
  };

  const handleManualAdd = async (data: { accountName: string; bankName: string; accountNumber: string; ifscCode: string; accountType: string; openingBalance: number }) => {
    const res = await fetch("/api/banking/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to add account");
    refresh();
  };

  const bankCode = (bankName: string) => bankName.slice(0, 2).toUpperCase();

  if (!isLoading && accounts.length === 0) {
    return (
      <div style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 500, gap: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Building2 size={32} color="#6366f1" />
        </div>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>No bank accounts connected</h2>
          <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 360, lineHeight: 1.6 }}>Connect your first bank account to start tracking transactions, reconciling, and generating AI insights.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, padding: "10px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "white", cursor: "pointer" }}>
          <Plus size={14} /> Connect Bank Account
        </button>
        {showAddModal && (
          <AddAccountModal
            onClose={() => setShowAddModal(false)}
            onConnectSetu={() => { setShowAddModal(false); connectSetu(); }}
            onManualAdd={handleManualAdd}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Bank Accounts</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {isLoading ? "Loading…" : `${activeAccounts.length} active account${activeAccounts.length !== 1 ? "s" : ""} · Total balance ${formatINR(totalBalance)}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={refresh} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer", fontWeight: 500 }}>
            <RefreshCw size={12} /> Sync All
          </button>
          <button onClick={() => setShowAddModal(true)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, background: "#6366f1", color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}>
            <Plus size={12} /> Add Account
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, maxWidth: 320, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px" }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts…" style={{ border: "none", outline: "none", fontSize: 13, background: "transparent", color: "var(--text-primary)", flex: 1 }} />
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[["all", "All"], ["active", "Active"], ["inactive", "Inactive"], ["expiring", "Consent Issues"]].map(([f, l]) => (
            <button key={f} onClick={() => setFilter(f)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: filter === f ? "#6366f1" : "var(--bg-card)", color: filter === f ? "white" : "var(--text-secondary)", cursor: "pointer", fontWeight: filter === f ? 600 : 400 }}>{l}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          {(["cards", "table"] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: viewMode === m ? "#6366f1" : "var(--bg-card)", color: viewMode === m ? "white" : "var(--text-secondary)", cursor: "pointer" }}>
              {m === "cards" ? "⊞" : "≡"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18, height: 260, opacity: 0.5 }} />
          ))}
        </div>
      ) : (
        <>
          {/* Cards View */}
          {viewMode === "cards" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
              {filtered.map(account => (
                <AccountCard key={account.id} account={account} bankCode={bankCode(account.bankName)} syncingId={syncingId} onSync={handleSync} onDelete={deleteAccount} />
              ))}
              <button onClick={() => setShowAddModal(true)} style={{ background: "var(--bg-card)", border: "2px dashed var(--border)", borderRadius: 12, padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer", color: "var(--text-muted)", minHeight: 220, justifyContent: "center" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(99,102,241,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Plus size={20} color="#6366f1" />
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Add Bank Account</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>Connect via AA or add manually</p>
              </button>
            </div>
          )}

          {/* Table View */}
          {viewMode === "table" && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg-hover)", borderBottom: "1px solid var(--border)" }}>
                    {["Bank / Account", "Type", "Balance", "Transactions", "Last Sync", "Health", "Consent", "Actions"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => (
                    <tr key={a.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none", opacity: a.isActive ? 1 : 0.6 }}>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#6366f1" }}>{bankCode(a.bankName)}</div>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{a.accountName}</p>
                            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.bankName} · {a.maskedNumber ?? a.accountNumber.slice(-4).padStart(a.accountNumber.length, "X")}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-secondary)" }}>{a.accountType}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{formatINR(a.currentBalance)}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Avail: {formatINR(a.availableBalance)}</p>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-secondary)" }}>{a._count?.bankTransactions ?? 0}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>{formatTimeAgo(a.lastSyncAt)}</p>
                        <SyncBadge status={a.lastSyncStatus} />
                      </td>
                      <td style={{ padding: "12px 14px" }}><HealthBar score={a.healthScore} /></td>
                      <td style={{ padding: "12px 14px" }}><ConsentBadge status={a.consentStatus} /></td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <a href={`/banking/transactions?bankAccountId=${a.id}`} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", cursor: "pointer", textDecoration: "none" }}>View</a>
                          <button onClick={() => handleSync(a.id)} disabled={syncingId === a.id} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", cursor: "pointer" }}>
                            {syncingId === a.id ? <Loader2 size={9} style={{ animation: "spin 1s linear infinite" }} /> : "Sync"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showAddModal && (
        <AddAccountModal
          onClose={() => setShowAddModal(false)}
          onConnectSetu={() => { setShowAddModal(false); connectSetu(); }}
          onManualAdd={handleManualAdd}
        />
      )}
    </div>
  );
}

function AccountCard({ account, bankCode, syncingId, onSync, onDelete }: {
  account: BankAccount;
  bankCode: string;
  syncingId: string | null;
  onSync: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isSyncing = syncingId === account.id;

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 14, opacity: account.isActive ? 1 : 0.6, position: "relative" }}>
      {/* Top */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#6366f1" }}>{bankCode}</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{account.bankName}</p>
              {account.isPrimary && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "rgba(99,102,241,0.12)", color: "#818cf8" }}>PRIMARY</span>}
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{account.maskedNumber ?? `XXXX XXXX ${account.accountNumber.slice(-4)}`} · {account.accountType}</p>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <button onClick={() => setMenuOpen(!menuOpen)} style={{ padding: 4, borderRadius: 6, border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div style={{ position: "absolute", right: 0, top: "100%", zIndex: 10, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: 4, minWidth: 170, boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
              {[
                [<Eye size={12} key="e" />, "View Transactions", () => { setMenuOpen(false); window.location.href = `/banking/transactions?bankAccountId=${account.id}`; }],
                [<RefreshCw size={12} key="r" />, "Sync Now", () => { setMenuOpen(false); onSync(account.id); }],
                [<KeyRound size={12} key="k" />, "Manage Consent", () => { setMenuOpen(false); window.location.href = "/banking/consent"; }],
                [<Download size={12} key="d" />, "Export", () => { setMenuOpen(false); window.location.href = "/banking/export"; }],
                [<Plug2 size={12} key="p" />, "Disconnect", () => { setMenuOpen(false); if (confirm("Remove this account?")) onDelete(account.id); }],
              ].map(([icon, label, onClick]) => (
                <button key={String(label)} onClick={onClick as () => void} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", fontSize: 12, border: "none", background: "none", cursor: "pointer", color: "var(--text-secondary)", borderRadius: 6, textAlign: "left" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                  {icon as React.ReactNode} {label as string}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Balance */}
      <div style={{ background: "var(--bg-hover)", borderRadius: 8, padding: "12px 14px" }}>
        <p style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Current Balance</p>
        <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{formatINR(account.currentBalance)}</p>
        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Available: {formatINR(account.availableBalance)}</p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <TrendingUp size={12} color="#10b981" />
          <div>
            <p style={{ fontSize: 10, color: "var(--text-muted)" }}>Transactions</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{account._count?.bankTransactions ?? 0}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <TrendingDown size={12} color={account.lastSyncStatus === "SUCCESS" ? "#10b981" : "#ef4444"} />
          <div>
            <p style={{ fontSize: 10, color: "var(--text-muted)" }}>Provider</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{account.connection?.provider ?? "Manual"}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ConsentBadge status={account.consentStatus} />
          <span style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 3 }}>
            <Clock size={9} /> {formatTimeAgo(account.lastSyncAt)}
          </span>
        </div>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: account.lastSyncStatus === "SUCCESS" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {account.lastSyncStatus === "SUCCESS" ? <Wifi size={10} color="#10b981" /> : <WifiOff size={10} color="#ef4444" />}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <a href={`/banking/transactions?bankAccountId=${account.id}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 11, padding: "7px 8px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", cursor: "pointer", textDecoration: "none", fontWeight: 500 }}>
          <Eye size={11} /> Transactions
        </a>
        <button onClick={() => onSync(account.id)} disabled={isSyncing} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 11, padding: "7px 8px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", cursor: isSyncing ? "not-allowed" : "pointer", fontWeight: 500 }}>
          {isSyncing ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={11} />}
          {isSyncing ? "Syncing…" : "Sync"}
        </button>
      </div>
    </div>
  );
}
