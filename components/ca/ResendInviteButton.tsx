"use client";

// ============================================================
// ResendInviteButton — CA Portal, client profile header.
// POST /api/customers/[id]/resend-invite: creates the first
// invitation if the client was added without one (Add Client form
// skips the invite flow entirely), or resends/refreshes an existing
// PENDING/SENT/EXPIRED invite. Refreshes the page on success so the
// onboarding tracker + status card pick up the new state.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";

export default function ResendInviteButton({
  customerId,
  hasInvitation,
}: {
  customerId: string;
  hasInvitation: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/resend-invite`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Failed to send invitation");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Failed to send invitation");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <button
        onClick={onClick}
        disabled={busy}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--text-secondary)",
          fontSize: 12,
          fontWeight: 600,
          cursor: busy ? "wait" : "pointer",
          opacity: busy ? 0.7 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        {busy ? "Sending…" : hasInvitation ? "Resend Invitation" : "Send Invitation"}
      </button>
      {error && <span style={{ fontSize: 11, color: "#ef4444", maxWidth: 180, textAlign: "right" }}>{error}</span>}
    </span>
  );
}
