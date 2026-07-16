"use client";

import { useState } from "react";
import { Search } from "lucide-react";

interface IfscResult {
  ifsc: string;
  bankName: string;
  bankCode: string;
  branch: string;
  address: string;
  city: string;
  district: string;
  state: string;
  contact: string | null;
  micr: string | null;
  upi: boolean;
  rtgs: boolean;
  neft: boolean;
  imps: boolean;
}

export default function IfscLookupPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<IfscResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lookup = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/verification/ifsc/${encodeURIComponent(code.trim().toUpperCase())}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Lookup failed");
      setResult(data.result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>IFSC Lookup</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Look up any Indian bank branch by its IFSC code — free, real-time, no case required</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, maxWidth: 420 }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          placeholder="e.g. SBIN0020112"
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", fontSize: 13, color: "var(--text-primary)", textTransform: "uppercase" }}
        />
        <button
          onClick={lookup}
          disabled={busy}
          style={{ padding: "10px 16px", background: "#6366f1", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          <Search size={14} /> {busy ? "Looking up…" : "Lookup"}
        </button>
      </div>

      {error && <p style={{ fontSize: 13, color: "#ef4444", marginBottom: 16 }}>{error}</p>}

      {result && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, maxWidth: 560 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{result.bankName}</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>{result.branch} Branch — {result.ifsc}</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
            <Field label="Bank Code" value={result.bankCode} />
            <Field label="MICR" value={result.micr ?? "—"} />
            <Field label="City" value={result.city} />
            <Field label="District" value={result.district} />
            <Field label="State" value={result.state} />
            <Field label="Contact" value={result.contact ?? "—"} />
          </div>

          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Address</p>
            <p style={{ fontSize: 13 }}>{result.address}</p>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            {[
              { label: "NEFT", ok: result.neft },
              { label: "RTGS", ok: result.rtgs },
              { label: "IMPS", ok: result.imps },
              { label: "UPI", ok: result.upi },
            ].map((r) => (
              <span
                key={r.label}
                style={{
                  padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                  background: r.ok ? "rgba(16,185,129,0.12)" : "rgba(107,114,128,0.12)",
                  color: r.ok ? "#10b981" : "#6b7280",
                  border: `1px solid ${r.ok ? "rgba(16,185,129,0.3)" : "rgba(107,114,128,0.3)"}`,
                }}
              >
                {r.label} {r.ok ? "✓" : "✕"}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>{label}</p>
      <p style={{ fontWeight: 600 }}>{value}</p>
    </div>
  );
}
