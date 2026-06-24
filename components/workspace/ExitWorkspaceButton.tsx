"use client";

// ============================================================
// ExitWorkspaceButton — ends the impersonation session.
// DELETE /api/ca/workspace clears the signed cookie and logs
// WORKSPACE_EXIT; a hard navigation then flushes every client-
// side cache that still holds the impersonated org's data.
// ============================================================

import { useState } from "react";
import { LogOut } from "lucide-react";

export default function ExitWorkspaceButton() {
  const [exiting, setExiting] = useState(false);

  const exitWorkspace = async () => {
    if (exiting) return;
    setExiting(true);
    try {
      const res = await fetch("/api/ca/workspace", { method: "DELETE" });
      const data = await res.json().catch(() => null);
      window.location.assign(data?.redirect ?? "/ca/virtual-access");
    } catch {
      setExiting(false);
    }
  };

  return (
    <button
      onClick={exitWorkspace}
      disabled={exiting}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.35)",
        background: "rgba(255,255,255,0.12)",
        color: "#fff",
        fontSize: 12,
        fontWeight: 600,
        cursor: exiting ? "wait" : "pointer",
        whiteSpace: "nowrap",
        opacity: exiting ? 0.7 : 1,
      }}
    >
      <LogOut size={13} />
      {exiting ? "Exiting…" : "Exit Workspace"}
    </button>
  );
}
