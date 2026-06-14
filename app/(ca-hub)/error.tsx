"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function CAHubError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ca-hub]", error);
  }, [error]);

  return (
    <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 420, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <AlertTriangle size={26} color="#ef4444" />
        </div>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>Something went wrong in CA Hub</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6 }}>
            {error.message || "An unexpected error occurred while loading this workspace."}
          </p>
        </div>
        <button
          onClick={reset}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600,
            padding: "9px 18px", borderRadius: 9, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white",
          }}
        >
          <RotateCcw size={14} /> Try again
        </button>
      </div>
    </div>
  );
}
