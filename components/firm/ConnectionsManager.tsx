"use client";

// ============================================================
// components/firm/ConnectionsManager.tsx
//
// CA-side UI for the pricing relationship: invite a business by email,
// see the list of connections + their plan, and unlink. Capacity is
// shown against the firm's plan ceiling (Solo 15 / Growing 75 / Firm ∞).
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { Mail, Plus, Link2Off, Loader2, CheckCircle2, Clock, Ban } from "lucide-react";
import type { EntitlementsDTO } from "@/lib/billing/entitlements";

interface RelationshipRow {
  id: string;
  status: "PENDING" | "ACTIVE" | "INACTIVE" | "TERMINATED";
  invitedEmail: string | null;
  invitedAt: string;
  businessOrganization: {
    id: string;
    name: string;
    planType: string | null;
    businessProfile: { businessName: string | null; gstin: string | null } | null;
  } | null;
}

const STATUS_META: Record<RelationshipRow["status"], { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  PENDING: { label: "Pending", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", icon: <Clock size={13} /> },
  ACTIVE: { label: "Connected", color: "#10b981", bg: "rgba(16,185,129,0.12)", icon: <CheckCircle2 size={13} /> },
  INACTIVE: { label: "Inactive", color: "#64748b", bg: "rgba(100,116,139,0.12)", icon: <Ban size={13} /> },
  TERMINATED: { label: "Unlinked", color: "#94a3b8", bg: "rgba(148,163,184,0.12)", icon: <Ban size={13} /> },
};

export function ConnectionsManager() {
  const [rows, setRows] = useState<RelationshipRow[]>([]);
  const [ent, setEnt] = useState<EntitlementsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ca/relationships");
      const data = await res.json();
      if (res.ok) {
        setRows(data.relationships ?? []);
        setEnt(data.entitlements ?? null);
      } else {
        setError(data.error ?? "Failed to load connections");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/ca/relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not send invitation");
      } else {
        setNotice(`Invitation sent to ${email.trim()}`);
        setEmail("");
        await load();
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function unlink(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/ca/relationships/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Could not unlink");
      else await load();
    } catch {
      setError("Network error");
    }
  }

  const atCapacity = ent ? !ent.isLegacy && ent.remainingClients === 0 : false;

  return (
    <div>
      {/* Capacity bar */}
      {ent && !ent.isLegacy && (
        <div className="section-card" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Client capacity</span>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {ent.activeClientCount}/{ent.clientLimit === null ? "∞" : ent.hardClientCeiling} used
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: "var(--bg-elevated)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: ent.clientLimit === null ? "12%" : `${Math.min((ent.activeClientCount / (ent.hardClientCeiling || 1)) * 100, 100)}%`,
                background: atCapacity ? "#ef4444" : "#10b981",
                borderRadius: 99,
                opacity: ent.clientLimit === null ? 0.35 : 1,
              }}
            />
          </div>
          {atCapacity && (
            <p style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>
              You&apos;ve reached your plan&apos;s client limit. <a href="/pricing" style={{ color: "#6366f1", fontWeight: 600 }}>Upgrade</a> to add more.
            </p>
          )}
        </div>
      )}

      {/* Invite form */}
      <div className="section-card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Invite a business</h3>
        <form onSubmit={invite} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
            <Mail size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="business@email.com"
              className="input"
              style={{ paddingLeft: 36, width: "100%" }}
              disabled={atCapacity}
            />
          </div>
          <button
            type="submit"
            disabled={submitting || atCapacity}
            className="btn-brand"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, opacity: atCapacity ? 0.5 : 1 }}
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Send invitation
          </button>
        </form>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
          They&apos;ll get the free <strong>Connected</strong> plan on acceptance. A Standalone business is auto-converted to Connected.
        </p>
        {notice && <p style={{ fontSize: 13, color: "#10b981", marginTop: 8 }}>{notice}</p>}
        {error && <p style={{ fontSize: 13, color: "#ef4444", marginTop: 8 }}>{error}</p>}
      </div>

      {/* List */}
      <div className="section-card">
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Connections</h3>
        {loading ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: 20 }}>
            <Loader2 size={16} className="animate-spin" style={{ display: "inline" }} /> Loading…
          </p>
        ) : rows.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: 24 }}>
            No connections yet. Invite your first client above.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((r) => {
              const meta = STATUS_META[r.status];
              const name = r.businessOrganization?.businessProfile?.businessName ?? r.businessOrganization?.name ?? r.invitedEmail ?? "—";
              return (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--bg-base)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {r.invitedEmail ?? r.businessOrganization?.businessProfile?.gstin ?? ""}
                      {r.businessOrganization?.planType ? ` · ${r.businessOrganization.planType.replace(/_/g, " ")}` : ""}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "3px 10px",
                        borderRadius: 99,
                        fontSize: 12,
                        fontWeight: 600,
                        color: meta.color,
                        background: meta.bg,
                      }}
                    >
                      {meta.icon}
                      {meta.label}
                    </span>
                    {(r.status === "ACTIVE" || r.status === "PENDING") && (
                      <button
                        type="button"
                        onClick={() => unlink(r.id)}
                        title="Unlink"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "5px 10px",
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          background: "transparent",
                          color: "var(--text-muted)",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        <Link2Off size={13} /> Unlink
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
