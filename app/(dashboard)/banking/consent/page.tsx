"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  KeyRound, CheckCircle2, AlertTriangle, X, Clock, Plus, Loader2, ShieldOff, RefreshCw,
} from "lucide-react";
import { useBankConsents, type BankConsentRecord } from "@/hooks/useBankConsents";
import { useBankSync } from "@/hooks/useBankSync";

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  ACTIVE:   { bg: "rgba(16,185,129,0.1)",   text: "#10b981", icon: <CheckCircle2 size={11} /> },
  EXPIRED:  { bg: "rgba(239,68,68,0.1)",    text: "#ef4444", icon: <X size={11} /> },
  REVOKED:  { bg: "rgba(239,68,68,0.1)",    text: "#ef4444", icon: <X size={11} /> },
  PENDING:  { bg: "rgba(245,158,11,0.1)",   text: "#f59e0b", icon: <Clock size={11} /> },
  REJECTED: { bg: "rgba(239,68,68,0.1)",    text: "#ef4444", icon: <X size={11} /> },
  PAUSED:   { bg: "rgba(100,116,139,0.1)",  text: "#64748b", icon: <Clock size={11} /> },
};

const CALLBACK_BANNERS: Record<string, { text: string; color: string; bg: string }> = {
  connected: { text: "Bank connected successfully. Initial sync has started — transactions will appear shortly.", color: "#10b981", bg: "rgba(16,185,129,0.06)" },
  rejected:  { text: "Consent was rejected. You can retry whenever you're ready.", color: "#ef4444", bg: "rgba(239,68,68,0.06)" },
  pending:   { text: "Consent is still pending approval at your bank.", color: "#f59e0b", bg: "rgba(245,158,11,0.06)" },
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
  // useSearchParams requires a Suspense boundary in the App Router
  return (
    <Suspense fallback={<div style={{ padding: 24 }} />}>
      <ConsentManagementContent />
    </Suspense>
  );
}

function ConsentManagementContent() {
  const { consents, isLoading, revokeConsent, isRevoking } = useBankConsents();
  const { connectSetu } = useBankSync();
  const searchParams = useSearchParams();
  const [actionError, setActionError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const callbackStatus = searchParams.get("status");
  const callbackError = searchParams.get("error");
  const banner = callbackStatus ? CALLBACK_BANNERS[callbackStatus] : null;

  const handleConnect = async (bankAccountId?: string) => {
    setActionError(null);
    setConnecting(true);
    try {
      await connectSetu(bankAccountId ? { bankAccountId } : undefined);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to start bank connection");
      setConnecting(false);
    }
  };

  const handleRevoke = async (consent: BankConsentRecord) => {
    setActionError(null);
    setConfirmRevokeId(null);
    try {
      await revokeConsent(consent.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to revoke consent");
    }
  };

  const expiringSoon = consents.filter(c => c.status === "ACTIVE" && (daysUntil(c.endDate) ?? 999) <= 10);
  const expired = consents.filter(c => c.status === "EXPIRED" || c.status === "REVOKED");
  const active = consents.filter(c => c.status === "ACTIVE");
  const pending = consents.filter(c => c.status === "PENDING");

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
        <button onClick={() => handleConnect()} disabled={connecting} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "white", cursor: connecting ? "wait" : "pointer", fontWeight: 600, opacity: connecting ? 0.7 : 1 }}>
          {connecting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} New Consent
        </button>
      </div>

      {/* Post-callback banner */}
      {banner && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: banner.bg, border: `1px solid ${banner.color}40` }}>
          <CheckCircle2 size={13} color={banner.color} />
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{banner.text}</p>
        </div>
      )}
      {callbackError && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <AlertTriangle size={13} color="#ef4444" />
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Connection error: <b>{callbackError.replace(/_/g, " ")}</b>. Please try again.
          </p>
        </div>
      )}
      {actionError && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <AlertTriangle size={13} color="#ef4444" />
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{actionError}</p>
        </div>
      )}

      {/* Stats */}
      {!isLoading && consents.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
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

      {/* Expiry alerts */}
      {!isLoading && expiringSoon.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {expiringSoon.map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <AlertTriangle size={13} color="#f59e0b" />
              <p style={{ fontSize: 12, flex: 1, color: "var(--text-secondary)" }}>
                <b>{c.bankAccount?.bankName ?? c.provider}</b> {c.bankAccount?.maskedNumber ? `(${c.bankAccount.maskedNumber})` : ""} consent expires in <b style={{ color: "#f59e0b" }}>{daysUntil(c.endDate)} days</b> on {formatDate(c.endDate)}
              </p>
              <button onClick={() => handleConnect(c.bankAccount?.id)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: "#f59e0b", color: "white", cursor: "pointer", fontWeight: 600 }}>Renew Now</button>
            </div>
          ))}
        </div>
      )}

      {/* Consent Table */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ height: 64, borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border)", opacity: 0.4 }} />)}
        </div>
      ) : consents.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 360, gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <KeyRound size={28} color="#6366f1" />
          </div>
          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>No consents yet</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 360 }}>
              Connect via Account Aggregator to securely share bank data and enable automatic sync.
            </p>
          </div>
          <button onClick={() => handleConnect()} disabled={connecting} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, padding: "10px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "white", cursor: "pointer" }}>
            <Plus size={14} /> Connect via Setu AA
          </button>
        </div>
      ) : (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Bank Account", "Provider", "Status", "Start Date", "End Date", "Days Left", "Last Fetch", "Actions"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {consents.map(c => {
                const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.PENDING;
                const days = daysUntil(c.endDate);
                const renewable = c.status === "EXPIRED" || c.status === "REVOKED" || c.status === "REJECTED" || (days !== null && days <= 10 && c.status === "ACTIVE");
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{c.bankAccount?.bankName ?? "Pending discovery"}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.bankAccount?.maskedNumber ?? c.vua ?? "—"}</p>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)" }}>{c.provider}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: cfg.bg, color: cfg.text }}>
                        {cfg.icon} {c.status}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)" }}>{formatDate(c.startDate)}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)" }}>{formatDate(c.endDate)}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12 }}>
                      {days === null ? "—" : (
                        <span style={{ fontWeight: 600, color: days < 0 ? "#ef4444" : days <= 10 ? "#f59e0b" : "#10b981" }}>
                          {days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d`}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)" }}>{formatDate(c.lastDataFetchAt)}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {renewable && (
                          <button onClick={() => handleConnect(c.bankAccount?.id)} title="Create a new consent for this account" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "#6366f1", cursor: "pointer", fontWeight: 600 }}>
                            <RefreshCw size={11} /> Renew
                          </button>
                        )}
                        {(c.status === "ACTIVE" || c.status === "PAUSED" || c.status === "PENDING") && (
                          confirmRevokeId === c.id ? (
                            <>
                              <button onClick={() => handleRevoke(c)} disabled={isRevoking(c.id)} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: "#ef4444", color: "white", cursor: "pointer", fontWeight: 600 }}>
                                {isRevoking(c.id) ? <Loader2 size={11} className="animate-spin" /> : <ShieldOff size={11} />} Confirm
                              </button>
                              <button onClick={() => setConfirmRevokeId(null)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)", cursor: "pointer", fontWeight: 600 }}>
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button onClick={() => setConfirmRevokeId(c.id)} title="Revoke this consent — data sync will stop" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.35)", background: "var(--bg-card)", color: "#ef4444", cursor: "pointer", fontWeight: 600 }}>
                              <ShieldOff size={11} /> Revoke
                            </button>
                          )
                        )}
                      </div>
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
