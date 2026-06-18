// ============================================================
// components/auth/AccessDenied.tsx
//
// In-app 403 screen rendered when a user opens a module/page their
// role cannot access (defense-in-depth for direct URL entry — the
// sidebar already locks the nav item). Server-component safe.
// ============================================================

import Link from "next/link";
import { Lock, ArrowLeft } from "lucide-react";

export default function AccessDenied({
  label,
  message,
}: {
  /** Human-readable module/page name, e.g. "CRM". */
  label?: string;
  /** Optional override for the body copy. */
  message?: string;
}) {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          textAlign: "center",
          background: "var(--bg-elevated, rgba(255,255,255,0.03))",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "40px 32px",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            margin: "0 auto 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.3)",
          }}
        >
          <Lock size={24} color="#ef4444" />
        </div>

        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
          Access denied
        </h1>

        <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 22 }}>
          {message ??
            `You don't have permission to access ${
              label ? `the ${label} module` : "this page"
            }. Ask an organization owner or admin if you need access.`}
        </p>

        <Link
          href="/dashboard"
          className="btn-brand"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <ArrowLeft size={15} /> Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
