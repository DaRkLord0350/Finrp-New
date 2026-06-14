"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 p-8">
      <div
        style={{
          width: 56, height: 56, borderRadius: 16,
          background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <AlertTriangle size={26} color="#ef4444" />
      </div>

      <div style={{ textAlign: "center" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
          Something went wrong
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 380 }}>
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        {error.digest && (
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, fontFamily: "monospace" }}>
            Error ID: {error.digest}
          </p>
        )}
      </div>

      <button
        onClick={reset}
        className="btn-ghost"
        style={{ gap: 7 }}
      >
        <RefreshCw size={14} /> Try again
      </button>
    </div>
  );
}
