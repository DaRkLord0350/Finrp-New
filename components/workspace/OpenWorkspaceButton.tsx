"use client";

// ============================================================
// OpenWorkspaceButton — enters a client workspace from the CA
// portal (All Customers / Assigned Customers pages).
// POST /api/ca/workspace validates the assignment server-side,
// sets the signed session cookie and logs WORKSPACE_ENTER; we
// then hard-navigate into the customer dashboard.
// ============================================================

import { useState } from "react";
import { ArrowRight, Loader2, Lock } from "lucide-react";

interface OpenWorkspaceButtonProps {
  organizationId: string;
  /** false = render a disabled "Not assigned" state */
  canOpen?: boolean;
  compact?: boolean;
}

export default function OpenWorkspaceButton({
  organizationId,
  canOpen = true,
  compact = false,
}: OpenWorkspaceButtonProps) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openWorkspace = async () => {
    if (opening || !canOpen) return;
    setOpening(true);
    setError(null);
    try {
      const res = await fetch("/api/ca/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Failed to open workspace");
        setOpening(false);
        return;
      }
      window.location.assign(data?.redirect ?? "/dashboard");
    } catch {
      setError("Failed to open workspace");
      setOpening(false);
    }
  };

  if (!canOpen) {
    return (
      <span
        title="Ask your firm admin to assign this client to you"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: compact ? "5px 10px" : "7px 14px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          color: "var(--text-muted)",
          fontSize: 12,
          fontWeight: 600,
          cursor: "not-allowed",
        }}
      >
        <Lock size={12} />
        Not assigned
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button
        onClick={openWorkspace}
        disabled={opening}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: compact ? "5px 10px" : "7px 14px",
          borderRadius: 8,
          border: "none",
          background: "linear-gradient(135deg, #6366f1, #0ea5e9)",
          color: "#fff",
          fontSize: 12,
          fontWeight: 600,
          cursor: opening ? "wait" : "pointer",
          opacity: opening ? 0.7 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {opening ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
        {opening ? "Opening…" : "Open Workspace"}
      </button>
      {error && (
        <span style={{ fontSize: 11, color: "#ef4444" }}>{error}</span>
      )}
    </span>
  );
}
