"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, Loader2 } from "lucide-react";
import OpenWorkspaceButton from "@/components/workspace/OpenWorkspaceButton";

type Tier = "READ_ONLY" | "READ_WRITE" | "ACCOUNTING_ONLY" | "COMPLIANCE_ONLY" | "FULL_ACCESS";

const TIER_OPTIONS: { value: Tier; label: string }[] = [
  { value: "READ_ONLY", label: "Read Only" },
  { value: "ACCOUNTING_ONLY", label: "Accounting Only" },
  { value: "COMPLIANCE_ONLY", label: "Compliance Only" },
  { value: "READ_WRITE", label: "Read & Write" },
  { value: "FULL_ACCESS", label: "Full Access" },
];

const TIER_COLOR: Record<Tier, string> = {
  READ_ONLY: "#94a3b8",
  READ_WRITE: "#6366f1",
  ACCOUNTING_ONLY: "#0ea5e9",
  COMPLIANCE_ONLY: "#f59e0b",
  FULL_ACCESS: "#10b981",
};

interface Props {
  customerId: string;
  name: string;
  company: string | null;
  organizationId: string | null;
  currentTier: Tier | null;
}

export default function VirtualAccessCard({ customerId, name, company, organizationId, currentTier }: Props) {
  const router = useRouter();
  const [tier, setTier] = useState<Tier>(currentTier ?? "READ_ONLY");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grant = async (next: Tier) => {
    setTier(next);
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/ca/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, tier: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to update access");
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, background: "linear-gradient(135deg,#6366f1,#0ea5e9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Building2 size={19} color="white" />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{company ?? "Client"}</p>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          Access Tier
          {saving && <Loader2 size={11} className="animate-spin" />}
          {saved && <Check size={12} color="#10b981" />}
        </label>
        <select
          value={tier}
          onChange={(e) => grant(e.target.value as Tier)}
          disabled={saving}
          style={{
            width: "100%",
            fontSize: 12.5,
            padding: "8px 10px",
            background: "var(--bg-elevated)",
            border: `1px solid ${TIER_COLOR[tier]}40`,
            borderRadius: 8,
            color: TIER_COLOR[tier],
            fontWeight: 600,
            cursor: saving ? "wait" : "pointer",
            outline: "none",
          }}
        >
          {TIER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {error && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{error}</p>}
      </div>

      <div style={{ marginTop: "auto", paddingTop: 4 }}>
        {organizationId ? (
          <OpenWorkspaceButton organizationId={organizationId} />
        ) : (
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            Workspace unavailable — client hasn&apos;t finished onboarding.
          </span>
        )}
      </div>
    </div>
  );
}
