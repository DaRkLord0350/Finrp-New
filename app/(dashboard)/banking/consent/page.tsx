"use client";

import { useState } from "react";
import { KeyRound, RefreshCw, X, CheckCircle2, AlertTriangle, Clock, Calendar, Shield, Plus } from "lucide-react";

const CONSENTS = [
  { id: "1", bank: "HDFC Bank", provider: "Setu AA", consentId: "CON-SETU-001", status: "ACTIVE", startDate: "2026-01-01", endDate: "2026-12-31", consentType: "RECURRING", frequency: "DAILY", fiTypes: ["DEPOSIT", "TERM_DEPOSIT"], daysRemaining: 204 },
  { id: "2", bank: "ICICI Bank", provider: "FinBox", consentId: "CON-FINBOX-012", status: "ACTIVE", startDate: "2026-02-01", endDate: "2026-11-30", consentType: "RECURRING", frequency: "DAILY", fiTypes: ["DEPOSIT"], daysRemaining: 173 },
  { id: "3", bank: "SBI", provider: "Setu AA", consentId: "CON-SETU-089", status: "ACTIVE", startDate: "2026-06-01", endDate: "2026-06-15", consentType: "RECURRING", frequency: "DAILY", fiTypes: ["DEPOSIT"], daysRemaining: 5 },
  { id: "4", bank: "Kotak Mahindra", provider: "Setu AA", consentId: "CON-SETU-034", status: "EXPIRED", startDate: "2025-12-01", endDate: "2026-06-08", consentType: "RECURRING", frequency: "WEEKLY", fiTypes: ["DEPOSIT"], daysRemaining: -2 },
  { id: "5", bank: "Axis Bank", provider: "FinBox", consentId: "CON-FINBOX-056", status: "ACTIVE", startDate: "2026-03-01", endDate: "2026-12-31", consentType: "RECURRING", frequency: "DAILY", fiTypes: ["DEPOSIT", "TERM_DEPOSIT"], daysRemaining: 204 },
];

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  ACTIVE:   { bg: "rgba(16,185,129,0.1)",   text: "#10b981", icon: <CheckCircle2 size={11} /> },
  EXPIRED:  { bg: "rgba(239,68,68,0.1)",    text: "#ef4444", icon: <X size={11} /> },
  REVOKED:  { bg: "rgba(239,68,68,0.1)",    text: "#ef4444", icon: <X size={11} /> },
  PENDING:  { bg: "rgba(245,158,11,0.1)",   text: "#f59e0b", icon: <Clock size={11} /> },
  PAUSED:   { bg: "rgba(100,116,139,0.1)",  text: "#64748b", icon: <Clock size={11} /> },
};

export default function ConsentManagementPage() {
  const [consents, setConsents] = useState(CONSENTS);

  const expiringSoon = consents.filter(c => c.status === "ACTIVE" && c.daysRemaining <= 10);
  const expired = consents.filter(c => c.status === "EXPIRED");
  const active = consents.filter(c => c.status === "ACTIVE");

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Consent Management</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Account Aggregator consent lifecycle management</p>
        </div>
        <button style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "white", cursor: "pointer", fontWeight: 600 }}>
          <Plus size={12} /> New Consent
        </button>
      </div>

      {/* Alerts */}
      {(expiringSoon.length > 0 || expired.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {expiringSoon.map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <AlertTriangle size={13} color="#f59e0b" />
              <p style={{ fontSize: 12, flex: 1, color: "var(--text-secondary)" }}>
                <b>{c.bank}</b> consent expires in <b style={{ color: "#f59e0b" }}>{c.daysRemaining} days</b> ({c.endDate})
              </p>
              <button style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: "#f59e0b", color: "white", cursor: "pointer", fontWeight: 600 }}>Renew Now</button>
            </div>
          ))}
          {expired.map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <X size={13} color="#ef4444" />
              <p style={{ fontSize: 12, flex: 1, color: "var(--text-secondary)" }}>
                <b>{c.bank}</b> consent <b style={{ color: "#ef4444" }}>expired</b> on {c.endDate}. Data sync is paused.
              </p>
              <button style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: "#ef4444", color: "white", cursor: "pointer", fontWeight: 600 }}>Reconnect</button>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {[
          ["Active Consents", active.length, "#10b981"],
          ["Expiring Soon", expiringSoon.length, "#f59e0b"],
          ["Expired", expired.length, "#ef4444"],
          ["Total", consents.length, "#6366f1"],
        ].map(([label, value, color]) => (
          <div key={String(label)} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>{label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: String(color) }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Consent Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
        {consents.map((consent) => {
          const s = STATUS_CONFIG[consent.status] ?? STATUS_CONFIG.PENDING;
          const progress = Math.max(0, Math.min(100, (consent.daysRemaining / 365) * 100));
          return (
            <div key={consent.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{consent.bank}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{consent.provider} · {consent.consentId}</p>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: s.bg, color: s.text }}>
                  {s.icon} {consent.status}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  ["Start Date", consent.startDate, <Calendar size={10} />],
                  ["End Date", consent.endDate, <Calendar size={10} />],
                  ["Type", consent.consentType, <Shield size={10} />],
                  ["Frequency", consent.frequency, <RefreshCw size={10} />],
                ].map(([label, value, icon]) => (
                  <div key={String(label)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                      <span style={{ color: "var(--text-muted)" }}>{icon as React.ReactNode}</span>
                      <p style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>{label as string}</p>
                    </div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>{value as string}</p>
                  </div>
                ))}
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <p style={{ fontSize: 10, color: "var(--text-muted)" }}>Consent validity</p>
                  <p style={{ fontSize: 10, fontWeight: 600, color: consent.daysRemaining > 30 ? "#10b981" : consent.daysRemaining > 0 ? "#f59e0b" : "#ef4444" }}>
                    {consent.daysRemaining > 0 ? `${consent.daysRemaining} days left` : `Expired ${Math.abs(consent.daysRemaining)}d ago`}
                  </p>
                </div>
                <div style={{ height: 5, borderRadius: 5, background: "var(--border)" }}>
                  <div style={{ height: 5, borderRadius: 5, background: consent.daysRemaining > 30 ? "#10b981" : consent.daysRemaining > 0 ? "#f59e0b" : "#ef4444", width: `${Math.max(0, progress)}%` }} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                {consent.status === "ACTIVE" ? (
                  <>
                    <button style={{ flex: 1, padding: "6px 0", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", fontSize: 11, color: "var(--text-secondary)", cursor: "pointer" }}>Renew</button>
                    <button style={{ flex: 1, padding: "6px 0", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", fontSize: 11, color: "var(--text-secondary)", cursor: "pointer" }}>Refresh</button>
                    <button style={{ flex: 1, padding: "6px 0", borderRadius: 7, border: "1px solid rgba(239,68,68,0.2)", background: "var(--bg-card)", fontSize: 11, color: "#ef4444", cursor: "pointer" }}>Revoke</button>
                  </>
                ) : (
                  <button style={{ flex: 1, padding: "6px 0", borderRadius: 7, border: "none", background: "#6366f1", fontSize: 11, color: "white", cursor: "pointer", fontWeight: 600 }}>Re-initiate Consent</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
