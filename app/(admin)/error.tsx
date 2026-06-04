"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error("[Admin Error]", error); }, [error]);
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-8">
      <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <AlertTriangle size={22} color="#ef4444" />
      </div>
      <div style={{ textAlign: "center" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Something went wrong</h2>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{error.message || "Please try again."}</p>
      </div>
      <button onClick={reset} className="btn-ghost" style={{ gap: 6 }}><RefreshCw size={13} /> Retry</button>
    </div>
  );
}
