"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Lock, AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import InvoicePreview, { type PreviewInvoiceData } from "@/components/billing/InvoicePreview";
import type { InvoiceAppearance } from "@/lib/invoices/appearance-defaults";

interface PublicPayload {
  requiresPassword: boolean;
  invoice?: PreviewInvoiceData;
  appearance?: InvoiceAppearance;
  qr?: string | null;
}

export default function PublicInvoicePage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [payload, setPayload] = useState<PublicPayload | null>(null);
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/public/invoices/${token}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "This invoice could not be loaded.");
        return;
      }
      if (data.requiresPassword) {
        setNeedsPassword(true);
        return;
      }
      setPayload(data as PublicPayload);
    } catch {
      setError("This invoice could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setUnlocking(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/invoices/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Incorrect password");
        return;
      }
      setNeedsPassword(false);
      setPayload(data as PublicPayload);
    } catch {
      setError("Could not verify password.");
    } finally {
      setUnlocking(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: "100vh", background: "var(--bg-base, #0b0b12)", display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px" }}>
      <div style={{ width: "100%", maxWidth: 760, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        {children}
        <p style={{ fontSize: 12, color: "var(--text-muted, #8b8b98)", display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <ShieldCheck size={13} /> Shared securely via FinRP
        </p>
      </div>
    </div>
  );

  if (loading) {
    return shell(
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted, #8b8b98)", padding: "80px 0" }}>
        <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} /> Loading invoice…
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error && !needsPassword) {
    return shell(
      <div style={{ background: "var(--bg-surface, #16161f)", border: "1px solid var(--border, #2a2a35)", borderRadius: 16, padding: 40, textAlign: "center", maxWidth: 440 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <AlertTriangle size={24} color="#ef4444" />
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary, #fff)", marginBottom: 6 }}>Unable to open invoice</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary, #b0b0bb)" }}>{error}</p>
      </div>
    );
  }

  if (needsPassword) {
    return shell(
      <form onSubmit={unlock} style={{ background: "var(--bg-surface, #16161f)", border: "1px solid var(--border, #2a2a35)", borderRadius: 16, padding: 32, width: "100%", maxWidth: 380, marginTop: 40 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(99,102,241,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Lock size={20} color="#818cf8" />
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary, #fff)", textAlign: "center", marginBottom: 6 }}>Password protected</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary, #b0b0bb)", textAlign: "center", marginBottom: 20 }}>Enter the password to view this invoice.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          style={{ width: "100%", background: "var(--bg-elevated, #1e1e2a)", border: "1px solid var(--border, #2a2a35)", borderRadius: 8, color: "var(--text-primary, #fff)", padding: "10px 12px", fontSize: 14, outline: "none", marginBottom: 12 }}
        />
        {error && <p style={{ fontSize: 12, color: "#ef4444", marginBottom: 12 }}>{error}</p>}
        <button type="submit" disabled={unlocking} className="btn-brand" style={{ width: "100%", justifyContent: "center" }}>
          {unlocking ? "Verifying…" : "View Invoice"}
        </button>
      </form>
    );
  }

  if (payload?.invoice && payload.appearance) {
    return shell(
      <div style={{ width: "100%" }}>
        <InvoicePreview appearance={payload.appearance} data={payload.invoice} qrSrc={payload.qr ?? undefined} />
      </div>
    );
  }

  return shell(<div style={{ color: "var(--text-muted, #8b8b98)", padding: "80px 0" }}>No invoice to display.</div>);
}
