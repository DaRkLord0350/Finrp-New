"use client";

// ============================================================
// /integrations/health — Connection status across every audited
// integration except Razorpay (which has its own billing surface).
// ============================================================

import Link from "next/link";
import { CheckCircle2, AlertCircle, XCircle, Ban, HeartPulse, ArrowLeft } from "lucide-react";
import { timeAgo } from "@/lib/integrations/status-presentation";
import type { IntegrationHealthStatus } from "@/lib/integrations/health";

interface Row {
  key: string;
  name: string;
  category: string;
  connected: boolean;
  status: IntegrationHealthStatus;
  lastSyncAt: string | null;
  errorDetails: string | null;
  manageHref: string | null;
}

const STATUS_PRESENTATION: Record<IntegrationHealthStatus, { icon: React.FC<{ size?: number }>; color: string; label: string }> = {
  healthy: { icon: CheckCircle2, color: "#10b981", label: "Connected" },
  error: { icon: AlertCircle, color: "#ef4444", label: "Error" },
  not_configured: { icon: XCircle, color: "#6b7280", label: "Not configured" },
  unavailable: { icon: Ban, color: "#6b7280", label: "Unavailable" },
};

export default function IntegrationHealthClient({ rows }: { rows: Row[] }) {
  const connectedCount = rows.filter((r) => r.connected).length;
  const errorCount = rows.filter((r) => r.status === "error").length;

  return (
    <div style={{ padding: "24px 28px 48px", maxWidth: 1040, margin: "0 auto" }}>
      <Link
        href="/integrations"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none", marginBottom: 16 }}
      >
        <ArrowLeft size={14} /> Back to Integrations
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #3b82f6, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <HeartPulse size={17} color="white" />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>Integration Health</h1>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        Connection status, last sync, and error details across every integration.
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#10b981", background: "#10b98112", border: "1px solid #10b98130", borderRadius: 20, padding: "5px 12px" }}>
          {connectedCount} connected
        </span>
        {errorCount > 0 && (
          <span style={{ fontSize: 12, fontWeight: 600, color: "#ef4444", background: "#ef444412", border: "1px solid #ef444430", borderRadius: 20, padding: "5px 12px" }}>
            {errorCount} need attention
          </span>
        )}
      </div>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1.6fr 0.8fr", gap: 12, padding: "10px 18px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)" }}>
          <span>Integration</span>
          <span>Connected</span>
          <span>Status</span>
          <span>Last Sync / Error Details</span>
          <span></span>
        </div>

        {rows.map((row) => {
          const p = STATUS_PRESENTATION[row.status];
          const Icon = p.icon;
          return (
            <div
              key={row.key}
              style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1.6fr 0.8fr", gap: 12, padding: "14px 18px", fontSize: 13, alignItems: "center", borderBottom: "1px solid var(--border)" }}
            >
              <div>
                <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{row.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{row.category}</div>
              </div>
              <span style={{ color: row.connected ? "#10b981" : "var(--text-muted)", fontWeight: 600 }}>
                {row.connected ? "Yes" : "No"}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: p.color, fontWeight: 600 }}>
                <Icon size={13} /> {p.label}
              </span>
              <span style={{ color: row.errorDetails ? "#ef4444" : "var(--text-muted)", fontSize: 12 }}>
                {row.errorDetails ?? (row.lastSyncAt ? `Last synced ${timeAgo(row.lastSyncAt)}` : "No sync data")}
              </span>
              <span>
                {row.manageHref && (
                  <Link href={row.manageHref} style={{ fontSize: 12, fontWeight: 600, color: "var(--brand-400)", textDecoration: "none" }}>
                    Manage
                  </Link>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
