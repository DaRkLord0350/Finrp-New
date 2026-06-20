"use client";

// ============================================================
// components/business/CAConnectionBanner.tsx
//
// Business-side surface for pending CA invitations. When a CA invites
// this business, accepting here links the relationship and unlocks the
// free Connected plan. Renders nothing when there's no pending invite.
// ============================================================

import { useEffect, useState } from "react";
import { Handshake, Loader2, CheckCircle2 } from "lucide-react";

interface PendingInvite {
  id: string;
  caOrganization: { id: string; name: string } | null;
  invitedAt: string;
}

export function CAConnectionBanner() {
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/business/ca-link");
        const data = await res.json();
        if (active && res.ok) setInvites(data.pendingInvitations ?? []);
      } catch {
        /* silent — banner is non-critical */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function accept(relationshipId: string) {
    setError(null);
    setAccepting(relationshipId);
    try {
      const res = await fetch("/api/business/ca-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationshipId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not accept invitation");
      } else {
        setAccepted(true);
        setInvites([]);
        // Reflect the new Connected plan across the app.
        setTimeout(() => window.location.reload(), 900);
      }
    } catch {
      setError("Network error");
    } finally {
      setAccepting(null);
    }
  }

  if (loading || (invites.length === 0 && !accepted)) return null;

  if (accepted) {
    return (
      <div style={bannerStyle("rgba(16,185,129,0.1)", "rgba(16,185,129,0.3)")}>
        <CheckCircle2 size={18} color="#10b981" />
        <span style={{ fontSize: 14, color: "#10b981", fontWeight: 600 }}>
          Connected! Your free Connected plan is now active.
        </span>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 10 }}>
      {invites.map((inv) => (
        <div key={inv.id} style={bannerStyle("rgba(99,102,241,0.08)", "rgba(99,102,241,0.25)")}>
          <Handshake size={18} color="#6366f1" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              {inv.caOrganization?.name ?? "A CA firm"} invited you to connect
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Accept to get the <strong>Connected</strong> plan free — filings, secure document sharing, and CA messaging.
            </p>
          </div>
          <button
            type="button"
            onClick={() => accept(inv.id)}
            disabled={accepting === inv.id}
            className="btn-brand"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}
          >
            {accepting === inv.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            Accept
          </button>
        </div>
      ))}
      {error && <p style={{ fontSize: 13, color: "#ef4444" }}>{error}</p>}
    </div>
  );
}

function bannerStyle(bg: string, border: string): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 18px",
    borderRadius: 12,
    background: bg,
    border: `1px solid ${border}`,
  };
}
