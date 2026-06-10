"use client";

import { KeyRound, CheckCircle2, AlertTriangle, X, Clock, Calendar, Plus, Loader2 } from "lucide-react";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useBankSync } from "@/hooks/useBankSync";

interface ConsentRecord {
  id: string;
  status: string;
  endDate: string | null;
  provider: string;
  frequency: string | null;
  fiTypes: string[];
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  ACTIVE:   { bg: "rgba(16,185,129,0.1)",   text: "#10b981", icon: <CheckCircle2 size={11} /> },
  EXPIRED:  { bg: "rgba(239,68,68,0.1)",    text: "#ef4444", icon: <X size={11} /> },
  REVOKED:  { bg: "rgba(239,68,68,0.1)",    text: "#ef4444", icon: <X size={11} /> },
  PENDING:  { bg: "rgba(245,158,11,0.1)",   text: "#f59e0b", icon: <Clock size={11} /> },
  REJECTED: { bg: "rgba(239,68,68,0.1)",    text: "#ef4444", icon: <X size={11} /> },
  PAUSED:   { bg: "rgba(100,116,139,0.1)",  text: "#64748b", icon: <Clock size={11} /> },
};

function daysUntil(endDate: string | null): number | null {
  if (!endDate) return null;
  return Math.round((new Date(endDate).getTime() - Date.now()) / 86400000);
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ConsentManagementPage() {
  const { accounts, isLoading } = useBankAccounts();
  const { connectSetu } = useBankSync();

  // Flatten all consents across all accounts
  const allConsents = accounts.flatMap(acc =>
    ((acc.consents ?? []) as ConsentRecord[]).map(c => ({
      ...c,
      bankName: acc.bankName,
      accountName: acc.accountName,
      maskedNumber: acc.maskedNumber,
      accountId: acc.id,
    }))
  );

  const expiringSoon = allConsents.filter(c => c.status === "ACTIVE" && (daysUntil(c.endDate) ?? 999) <= 10);
  const expired = allConsents.filter(c => c.status === "EXPIRED" || c.status === "REVOKED");
  const active = allConsents.filter(c => c.status === "ACTIVE");
  const pending = allConsents.filter(c => c.status === "PENDING");

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <KeyRound size={20} color="#6366f1" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Consent Management</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Account Aggregator consent lifecycle management</p>
          </div>
        </div>
        <button onClick={() => connectSetu()} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "white", cursor: "pointer", fontWeight: 600 }}>
          <Plus size={12} /> New Consent
        </button>
      </div>

      {/* Stats */}
      {!isLoading && allConsents.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            { label: "Active", value: active.length, color: "#10b981" },
            { label: "Expiring Soon", value: expiringSoon.length, color: "#f59e0b" },
            { label: "Expired / Revoked", value: expired.length, color: "#ef4444" },
            { label: "Pending", value: pending.length, color: "#818cf8" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
              <p style={{ fontSize: 22, fontWeight: 700, color }}>{value}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Alerts */}
      {!isLoading && (expiringSoon.length > 0 || expired.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {expiringSoon.map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <AlertTriangle size={13} color="#f59e0b" />
              <p style={{ fontSize: 12, flex: 1, color: "var(--text-secondary)" }}>
                <b>{c.bankName}</b> ({c.maskedNumber}) consent expires in <b style={{ color: "#f59e0b" }}>{daysUntil(c.endDate)} days</b> on {formatDate(c.endDate)}
              </p>
              <button onClick={() => connectSetu()} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: "#f59e0b", color: "white", cursor: "pointer", fontWeight: 600 }}>Renew Now</button>
            </div>
          ))}
          {expired.slice(0, 3).map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <X size={13} color="#ef4444" />
              <p style={{ fontSize: 12, flex: 1, color: "var(--text-secondary)" }}>
                <b>{c.bankName}</b> ({c.maskedNumber}) consent <b style={{ color: "#ef4444" }}>expired</b> on {formatDate(c.endDate)}. Data sync is paused.
              </p>
              <button onClick={() => connectSetu()} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: "#ef4444", color: "white", cursor: "pointer", fontWeight: 600 }}>Reconnect</button>
            </div>
          ))}
        </div>
      )}

      {/* Consent Table */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ height: 64, borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border)", opacity: 0.4 }} />)}
        </div>
      ) : allConsents.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 360, gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <KeyRound size={28} color="#6366f1" />
          </div>
          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>No consents yet</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 360 }}>
              {accounts.length === 0
                ? "Connect a bank account first to see consent details."
                : "No AA consents found. Connect via Account Aggregator to enable automatic sync."}
            </p>
          </div>
          <button onClick={() => connectSetu()} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, padding: "10px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "white", cursor: "pointer" }}>
            <Plus size={14} /> Connect via Setu AA
          </button>
        </div>
      ) : (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Bank Account", "Provider", "Status", "Start Date", "End Date", "Days Left", "Frequency", "Action"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allConsents.map(c => {
                const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.PENDING;
                const days = daysUntil(c.endDate);
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{c.bankName}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.maskedNumber}</p>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)" }}>{c.provider}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: cfg.bg, color: cfg.text }}>
                        {cfg.icon} {c.status}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)" }}>—</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)" }}>{formatDate(c.endDate)}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12 }}>
                      {days === null ? "—" : (
                        <span style={{ fontWeight: 600, color: days < 0 ? "#ef4444" : days <= 10 ? "#f59e0b" : "#10b981" }}>
                          {days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d`}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)" }}>{c.frequency ?? "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      {(c.status === "EXPIRED" || c.status === "REVOKED" || (days !== null && days <= 10 && c.status === "ACTIVE")) && (
                        <button onClick={() => connectSetu()} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "#6366f1", cursor: "pointer", fontWeight: 600 }}>
                          Renew
                        </button>
                      )}
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
