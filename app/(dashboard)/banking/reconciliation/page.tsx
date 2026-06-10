"use client";

import { useState } from "react";
import {
  Plus, Zap, CheckCircle2, ArrowLeftRight, Calendar,
  ChevronRight, Loader2, X, Building2,
} from "lucide-react";
import { useReconcileSessions, useReconcileSession, type ReconcileSession } from "@/hooks/useReconciliation";
import { useBankAccounts } from "@/hooks/useBankAccounts";

function formatINR(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  PENDING:     { bg: "rgba(245,158,11,0.1)",  text: "#f59e0b" },
  IN_PROGRESS: { bg: "rgba(99,102,241,0.1)",  text: "#818cf8" },
  COMPLETED:   { bg: "rgba(16,185,129,0.1)",  text: "#10b981" },
  CANCELLED:   { bg: "rgba(100,116,139,0.1)", text: "#64748b" },
};

const MATCH_STYLES: Record<string, string> = {
  MATCHED:  "#10b981",
  PARTIAL:  "#6366f1",
  UNMATCHED: "#f59e0b",
  EXCEPTION: "#ef4444",
};

function NewSessionModal({ accounts, onCreate, onClose }: {
  accounts: Array<{ id: string; bankName: string; accountNumber: string; maskedNumber: string | null }>;
  onCreate: (opts: { bankAccountId: string; name: string; startDate: string; endDate: string; openingBalance?: number; closingBalance?: number }) => Promise<string>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ bankAccountId: accounts[0]?.id ?? "", name: "", startDate: "", endDate: "", openingBalance: "", closingBalance: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bankAccountId || !form.startDate || !form.endDate) { setError("Bank account, start date and end date are required."); return; }
    setLoading(true);
    try {
      await onCreate({
        bankAccountId: form.bankAccountId,
        name: form.name || undefined as unknown as string,
        startDate: form.startDate,
        endDate: form.endDate,
        openingBalance: form.openingBalance ? Number(form.openingBalance) : undefined,
        closingBalance: form.closingBalance ? Number(form.closingBalance) : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, width: 440, maxWidth: "calc(100vw - 32px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>New Reconciliation Session</h3>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><X size={16} color="var(--text-muted)" /></button>
        </div>
        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Bank Account</label>
            <select value={form.bankAccountId} onChange={e => setForm(f => ({ ...f, bankAccountId: e.target.value }))} style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.bankName} · {a.maskedNumber ?? a.accountNumber.slice(-4)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Session Name (optional)</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. June 2026 Reconciliation" style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Start Date</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>End Date</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", boxSizing: "border-box" }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Opening Balance (₹)</label>
              <input type="number" value={form.openingBalance} onChange={e => setForm(f => ({ ...f, openingBalance: e.target.value }))} placeholder="Optional" style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", boxSizing: "border-box", outline: "none" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Closing Balance (₹)</label>
              <input type="number" value={form.closingBalance} onChange={e => setForm(f => ({ ...f, closingBalance: e.target.value }))} placeholder="Optional" style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", boxSizing: "border-box", outline: "none" }} />
            </div>
          </div>
          {error && <p style={{ fontSize: 12, color: "#ef4444" }}>{error}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={loading} style={{ flex: 2, padding: "9px 0", borderRadius: 8, border: "none", background: "#6366f1", fontSize: 13, fontWeight: 600, color: "white", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Creating…" : "Create Session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SessionDetail({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const { session, matches, isLoading, matchRate, autoMatch, completeSession } = useReconcileSession(sessionId);
  const [autoMatchLoading, setAutoMatchLoading] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [autoMatchResult, setAutoMatchResult] = useState<{ matched: number; suggested: number } | null>(null);

  const handleAutoMatch = async () => {
    setAutoMatchLoading(true);
    try {
      const res = await autoMatch();
      setAutoMatchResult(res);
    } finally {
      setAutoMatchLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!confirm("Mark this session as complete? This cannot be undone.")) return;
    setCompleteLoading(true);
    try { await completeSession(); }
    finally { setCompleteLoading(false); }
  };

  if (isLoading || !session) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
        <Loader2 size={20} color="var(--text-muted)" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Session Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>←</button>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{session.name ?? `${session.bankAccount.bankName} Session`}</h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatDate(session.startDate)} – {formatDate(session.endDate)} · {session.bankAccount.bankName}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {session.status === "IN_PROGRESS" && (
            <>
              <button onClick={handleAutoMatch} disabled={autoMatchLoading} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(99,102,241,0.08)", color: "#6366f1", cursor: "pointer", fontWeight: 600 }}>
                {autoMatchLoading ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={12} />} Auto-Match
              </button>
              <button onClick={handleComplete} disabled={completeLoading} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "white", cursor: "pointer", fontWeight: 600 }}>
                {completeLoading ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle2 size={12} />} Complete
              </button>
            </>
          )}
        </div>
      </div>

      {autoMatchResult && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", fontSize: 12, color: "#10b981" }}>
          Auto-match complete: {autoMatchResult.matched} confirmed, {autoMatchResult.suggested} suggested
        </div>
      )}

      {/* Progress */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 20 }}>
            {[["Matched", session.matchedTxns, "#10b981"], ["Unmatched", session.unmatchedTxns, "#f59e0b"], ["Exceptions", session.exceptionTxns, "#ef4444"], ["Total", session.totalTxns, "var(--text-secondary)"]].map(([l, v, c]) => (
              <div key={String(l)}>
                <p style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>{l}</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: String(c) }}>{v}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 28, fontWeight: 700, color: matchRate >= 80 ? "#10b981" : "#f59e0b" }}>{matchRate}%</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Reconciled</p>
          </div>
        </div>
        <div style={{ height: 8, borderRadius: 8, background: "var(--border)", overflow: "hidden" }}>
          <div style={{ height: 8, background: "linear-gradient(90deg, #10b981, #6366f1)", width: `${matchRate}%`, borderRadius: 8, transition: "width 0.5s ease" }} />
        </div>
      </div>

      {/* Matches Table */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Matches ({matches.length})</h3>
        </div>
        {matches.length === 0 ? (
          <div style={{ padding: "32px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            No matches yet. Use Auto-Match to find candidate matches.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-hover)", borderBottom: "1px solid var(--border)" }}>
                  {["Date", "Narration", "Amount", "Match Type", "Confidence", "Entity Ref", "Status"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => {
                  const amt = (m.bankTransaction.credit ?? 0) - (m.bankTransaction.debit ?? 0);
                  const absAmt = Math.abs(amt);
                  const isCredit = amt > 0;
                  return (
                    <tr key={m.id} style={{ borderBottom: i < matches.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {formatDate(m.bankTransaction.transactionDate)}
                      </td>
                      <td style={{ padding: "10px 14px", maxWidth: 260 }}>
                        <p style={{ fontSize: 12, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.bankTransaction.narration}</p>
                        {m.bankTransaction.referenceNumber && <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{m.bankTransaction.referenceNumber}</p>}
                      </td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: isCredit ? "#10b981" : "#ef4444" }}>
                          {isCredit ? "+" : "−"}{formatINR(absAmt)}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-secondary)" }}>{m.matchType}</td>
                      <td style={{ padding: "10px 14px" }}>
                        {m.confidence != null ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 40, height: 4, borderRadius: 4, background: "var(--border)" }}>
                              <div style={{ width: `${m.confidence}%`, height: 4, borderRadius: 4, background: m.confidence >= 80 ? "#10b981" : m.confidence >= 50 ? "#f59e0b" : "#ef4444" }} />
                            </div>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.confidence}%</span>
                          </div>
                        ) : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-secondary)" }}>{m.entityRef ?? m.entityType ?? "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: `${MATCH_STYLES[m.status] ?? "#64748b"}18`, color: MATCH_STYLES[m.status] ?? "#64748b" }}>{m.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReconciliationPage() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  const { sessions, isLoading, createSession } = useReconcileSessions();
  const { accounts } = useBankAccounts();

  const handleCreate = async (opts: Parameters<typeof createSession>[0]) => {
    const id = await createSession(opts);
    setSelectedSessionId(id);
    return id;
  };

  if (selectedSessionId) {
    return (
      <div style={{ padding: 24 }}>
        <SessionDetail sessionId={selectedSessionId} onBack={() => setSelectedSessionId(null)} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Reconciliation Center</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Match bank transactions to ledger entries</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          disabled={accounts.length === 0}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "white", cursor: accounts.length === 0 ? "not-allowed" : "pointer", fontWeight: 600, opacity: accounts.length === 0 ? 0.5 : 1 }}
        >
          <Plus size={12} /> New Session
        </button>
      </div>

      {/* Empty / Loading */}
      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
          <Loader2 size={20} color="var(--text-muted)" style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeftRight size={28} color="#6366f1" />
          </div>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>No reconciliation sessions</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 360 }}>Create a session to start matching bank transactions with your ledger entries.</p>
          </div>
          {accounts.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Connect a bank account first to start reconciling.</p>
          ) : (
            <button onClick={() => setShowNewModal(true)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, padding: "10px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "white", cursor: "pointer" }}>
              <Plus size={14} /> New Session
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          {sessions.map((s, i) => (
            <SessionRow key={s.id} session={s} isLast={i === sessions.length - 1} onClick={() => setSelectedSessionId(s.id)} />
          ))}
        </div>
      )}

      {showNewModal && accounts.length > 0 && (
        <NewSessionModal
          accounts={accounts.map(a => ({ id: a.id, bankName: a.bankName, accountNumber: a.accountNumber, maskedNumber: a.maskedNumber }))}
          onCreate={handleCreate}
          onClose={() => setShowNewModal(false)}
        />
      )}
    </div>
  );
}

function SessionRow({ session, isLast, onClick }: { session: ReconcileSession; isLast: boolean; onClick: () => void }) {
  const pct = session.totalTxns > 0 ? Math.round((session.matchedTxns / session.totalTxns) * 100) : 0;
  const ss = STATUS_STYLES[session.status] ?? STATUS_STYLES.PENDING;

  return (
    <div
      onClick={onClick}
      style={{ padding: "14px 16px", borderBottom: isLast ? "none" : "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, transition: "background 0.1s" }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Building2 size={18} color="#6366f1" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            {session.name ?? `${session.bankAccount.bankName} · ${formatDate(session.startDate)}`}
          </p>
          <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: ss.bg, color: ss.text }}>{session.status}</span>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {session.bankAccount.accountName} · {formatDate(session.startDate)} – {formatDate(session.endDate)}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 4, background: "var(--border)", maxWidth: 160 }}>
            <div style={{ width: `${pct}%`, height: 4, borderRadius: 4, background: pct >= 80 ? "#10b981" : "#f59e0b" }} />
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{pct}% · {session.matchedTxns}/{session.totalTxns} matched</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
        {[["Matched", session.matchedTxns, "#10b981"], ["Unmatched", session.unmatchedTxns, "#f59e0b"], ["Exceptions", session.exceptionTxns, "#ef4444"]].map(([l, v, c]) => (
          <div key={String(l)} style={{ textAlign: "center" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: String(c) }}>{v}</p>
            <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{l}</p>
          </div>
        ))}
      </div>
      <ChevronRight size={16} color="var(--text-muted)" />
    </div>
  );
}
