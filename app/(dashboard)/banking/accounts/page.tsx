"use client";

import { useState } from "react";
import {
  Plus, Search, RefreshCw, MoreHorizontal, Eye, GitMerge,
  ArrowLeftRight, Download, Plug2, Wifi, WifiOff, Clock,
  TrendingUp, TrendingDown, Shield, AlertTriangle, Building2,
  KeyRound, CheckCircle2, XCircle, Zap,
} from "lucide-react";

interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  accountType: string;
  currentBalance: number;
  availableBalance: number;
  currency: string;
  isPrimary: boolean;
  isActive: boolean;
  lastSyncAt: string;
  lastSyncStatus: "SUCCESS" | "FAILED" | "PARTIAL" | null;
  healthScore: number;
  consentStatus: "ACTIVE" | "EXPIRED" | "EXPIRING" | "REVOKED" | "NONE";
  provider: string;
  monthlyInflow: number;
  monthlyOutflow: number;
  bankCode: string;
  ifscCode: string;
  branchName: string;
}

const MOCK_ACCOUNTS: BankAccount[] = [
  { id: "1", bankName: "HDFC Bank", accountName: "Primary Current Account", accountNumber: "XXXX XXXX 4821", accountType: "CURRENT", currentBalance: 12400000, availableBalance: 12200000, currency: "INR", isPrimary: true, isActive: true, lastSyncAt: "2 mins ago", lastSyncStatus: "SUCCESS", healthScore: 98, consentStatus: "ACTIVE", provider: "Setu AA", monthlyInflow: 6200000, monthlyOutflow: 4100000, bankCode: "HDFC", ifscCode: "HDFC0001234", branchName: "Andheri West" },
  { id: "2", bankName: "ICICI Bank", accountName: "Operating Account", accountNumber: "XXXX XXXX 9032", accountType: "CURRENT", currentBalance: 8200000, availableBalance: 7900000, currency: "INR", isPrimary: false, isActive: true, lastSyncAt: "5 mins ago", lastSyncStatus: "SUCCESS", healthScore: 95, consentStatus: "ACTIVE", provider: "FinBox", monthlyInflow: 3400000, monthlyOutflow: 2800000, bankCode: "ICIC", ifscCode: "ICIC0004521", branchName: "Bandra East" },
  { id: "3", bankName: "SBI", accountName: "Savings Account", accountNumber: "XXXX XXXX 1197", accountType: "SAVINGS", currentBalance: 4700000, availableBalance: 4650000, currency: "INR", isPrimary: false, isActive: true, lastSyncAt: "1 hr ago", lastSyncStatus: "PARTIAL", healthScore: 72, consentStatus: "EXPIRING", provider: "Setu AA", monthlyInflow: 1800000, monthlyOutflow: 1400000, bankCode: "SBIN", ifscCode: "SBIN0012345", branchName: "Malad Branch" },
  { id: "4", bankName: "Axis Bank", accountName: "Cash Credit OD", accountNumber: "XXXX XXXX 7634", accountType: "CASH_CREDIT", currentBalance: 3240000, availableBalance: 3100000, currency: "INR", isPrimary: false, isActive: true, lastSyncAt: "15 mins ago", lastSyncStatus: "SUCCESS", healthScore: 88, consentStatus: "ACTIVE", provider: "HDFC API", monthlyInflow: 900000, monthlyOutflow: 1400000, bankCode: "UTIB", ifscCode: "UTIB0001899", branchName: "Powai" },
  { id: "5", bankName: "Kotak Mahindra", accountName: "Escrow Account", accountNumber: "XXXX XXXX 3321", accountType: "CURRENT", currentBalance: 0, availableBalance: 0, currency: "INR", isPrimary: false, isActive: false, lastSyncAt: "3 days ago", lastSyncStatus: "FAILED", healthScore: 0, consentStatus: "EXPIRED", provider: "Manual", monthlyInflow: 0, monthlyOutflow: 0, bankCode: "KKBK", ifscCode: "KKBK0000998", branchName: "Lower Parel" },
];

function formatINR(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toFixed(0)}`;
}

function ConsentBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    ACTIVE:   { bg: "rgba(16,185,129,0.12)", text: "#10b981", label: "Active" },
    EXPIRED:  { bg: "rgba(239,68,68,0.12)",  text: "#ef4444", label: "Expired" },
    EXPIRING: { bg: "rgba(245,158,11,0.12)", text: "#f59e0b", label: "Expiring" },
    REVOKED:  { bg: "rgba(239,68,68,0.12)",  text: "#ef4444", label: "Revoked" },
    NONE:     { bg: "rgba(100,116,139,0.12)", text: "#64748b", label: "None" },
  };
  const s = styles[status] ?? styles.NONE;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: s.bg, color: s.text }}>
      {s.label}
    </span>
  );
}

function SyncBadge({ status }: { status: string | null }) {
  if (!status) return <span style={{ fontSize: 10, color: "var(--text-muted)" }}>—</span>;
  const map: Record<string, { c: string; icon: React.ReactNode }> = {
    SUCCESS: { c: "#10b981", icon: <CheckCircle2 size={10} /> },
    FAILED:  { c: "#ef4444", icon: <XCircle size={10} /> },
    PARTIAL: { c: "#f59e0b", icon: <AlertTriangle size={10} /> },
  };
  const s = map[status] ?? map.PARTIAL;
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: s.c }}>
      {s.icon} {status}
    </span>
  );
}

function HealthBar({ score }: { score: number }) {
  const c = score >= 90 ? "#10b981" : score >= 70 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 60, height: 4, borderRadius: 4, background: "var(--border)" }}>
        <div style={{ width: `${score}%`, height: 4, borderRadius: 4, background: c }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: c }}>{score}</span>
    </div>
  );
}

export default function BankAccountsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const filtered = MOCK_ACCOUNTS.filter((a) => {
    const q = search.toLowerCase();
    if (!a.bankName.toLowerCase().includes(q) && !a.accountName.toLowerCase().includes(q)) return false;
    if (filter === "active" && !a.isActive) return false;
    if (filter === "inactive" && a.isActive) return false;
    if (filter === "expiring" && a.consentStatus !== "EXPIRING" && a.consentStatus !== "EXPIRED") return false;
    return true;
  });

  const totalBalance = MOCK_ACCOUNTS.filter(a => a.isActive).reduce((s, a) => s + a.currentBalance, 0);

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Bank Accounts</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {MOCK_ACCOUNTS.filter(a => a.isActive).length} active accounts · Total balance {formatINR(totalBalance)}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer", fontWeight: 500 }}>
            <RefreshCw size={12} /> Sync All
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, background: "#6366f1", color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}>
            <Plus size={12} /> Add Account
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, maxWidth: 320, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px" }}>
          <Search size={13} color="var(--text-muted)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts..."
            style={{ border: "none", outline: "none", fontSize: 13, background: "transparent", color: "var(--text-primary)", flex: 1 }}
          />
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["all", "active", "inactive", "expiring"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)",
              background: filter === f ? "#6366f1" : "var(--bg-card)",
              color: filter === f ? "white" : "var(--text-secondary)",
              cursor: "pointer", textTransform: "capitalize", fontWeight: filter === f ? 600 : 400,
            }}>{f === "all" ? "All" : f === "expiring" ? "Consent Issues" : f.charAt(0).toUpperCase() + f.slice(1)}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          {(["cards", "table"] as const).map((m) => (
            <button key={m} onClick={() => setViewMode(m)} style={{
              fontSize: 12, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)",
              background: viewMode === m ? "#6366f1" : "var(--bg-card)",
              color: viewMode === m ? "white" : "var(--text-secondary)", cursor: "pointer",
            }}>{m === "cards" ? "⊞" : "≡"}</button>
          ))}
        </div>
      </div>

      {/* Cards View */}
      {viewMode === "cards" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {filtered.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
          {/* Add account card */}
          <button style={{
            background: "var(--bg-card)", border: "2px dashed var(--border)", borderRadius: 12,
            padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center",
            gap: 8, cursor: "pointer", color: "var(--text-muted)", minHeight: 220,
            justifyContent: "center",
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(99,102,241,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Plus size={20} color="#6366f1" />
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Add Bank Account</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>Connect via AA, API, or add manually</p>
          </button>
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-hover)", borderBottom: "1px solid var(--border)" }}>
                {["Bank / Account", "Type", "Balance", "Last Sync", "Health", "Consent", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr key={a.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#6366f1" }}>
                        {a.bankCode.slice(0, 2)}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{a.accountName}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.bankName} · {a.accountNumber}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-secondary)" }}>{a.accountType}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{formatINR(a.currentBalance)}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Avail: {formatINR(a.availableBalance)}</p>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>{a.lastSyncAt}</p>
                    <SyncBadge status={a.lastSyncStatus} />
                  </td>
                  <td style={{ padding: "12px 14px" }}><HealthBar score={a.healthScore} /></td>
                  <td style={{ padding: "12px 14px" }}><ConsentBadge status={a.consentStatus} /></td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", cursor: "pointer" }}>View</button>
                      <button style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", cursor: "pointer" }}>Sync</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AccountCard({ account }: { account: BankAccount }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const netFlow = account.monthlyInflow - account.monthlyOutflow;

  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12,
      padding: 18, display: "flex", flexDirection: "column", gap: 14,
      opacity: account.isActive ? 1 : 0.6, position: "relative",
    }}>
      {/* Top */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#6366f1" }}>
            {account.bankCode.slice(0, 2)}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{account.bankName}</p>
              {account.isPrimary && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "rgba(99,102,241,0.12)", color: "#818cf8" }}>PRIMARY</span>
              )}
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{account.accountNumber} · {account.accountType}</p>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <button onClick={() => setMenuOpen(!menuOpen)} style={{ padding: 4, borderRadius: 6, border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div style={{ position: "absolute", right: 0, top: "100%", zIndex: 10, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: 4, minWidth: 160, boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
              {[
                [<Eye size={12} />, "View Transactions"],
                [<RefreshCw size={12} />, "Sync Now"],
                [<KeyRound size={12} />, "Manage Consent"],
                [<GitMerge2 size={12} />, "Reconcile"],
                [<Download size={12} />, "Export"],
                [<Plug2 size={12} />, "Disconnect"],
              ].map(([icon, label]) => (
                <button key={String(label)} onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", fontSize: 12, border: "none", background: "none", cursor: "pointer", color: "var(--text-secondary)", borderRadius: 6, textAlign: "left" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
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

      {/* Monthly Flow */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <TrendingUp size={12} color="#10b981" />
          <div>
            <p style={{ fontSize: 10, color: "var(--text-muted)" }}>Inflow</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#10b981" }}>{formatINR(account.monthlyInflow)}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <TrendingDown size={12} color="#ef4444" />
          <div>
            <p style={{ fontSize: 10, color: "var(--text-muted)" }}>Outflow</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#ef4444" }}>{formatINR(account.monthlyOutflow)}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ConsentBadge status={account.consentStatus} />
          <span style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 3 }}>
            <Clock size={9} /> {account.lastSyncAt}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: account.lastSyncStatus === "SUCCESS" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {account.lastSyncStatus === "SUCCESS" ? <Wifi size={10} color="#10b981" /> : <WifiOff size={10} color="#ef4444" />}
          </div>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{account.provider}</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {[
          [<ArrowLeftRight size={11} />, "Transactions"],
          [<RefreshCw size={11} />, "Sync"],
          [<Eye size={11} />, "Reconcile"],
        ].map(([icon, label]) => (
          <button key={String(label)} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            fontSize: 11, padding: "6px 8px", borderRadius: 7, border: "1px solid var(--border)",
            background: "var(--bg-card)", color: "var(--text-secondary)", cursor: "pointer", fontWeight: 500,
          }}>
            {icon as React.ReactNode} {label as string}
          </button>
        ))}
      </div>
    </div>
  );
}

function GitMerge2(props: { size?: number }) {
  return (
    <svg width={props.size ?? 12} height={props.size ?? 12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M6 21V9a9 9 0 0 0 9 9" />
    </svg>
  );
}
