"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@/lib/queryCache";
import { StatusBadge } from "@/components/ui/status-badge";

interface RuleRow {
  id: string;
  ruleType: string;
  name: string;
  description: string | null;
  enabled: boolean;
  severity: string;
  config: Record<string, number>;
}

async function api(url: string, opts?: RequestInit) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

const RULE_TYPES = [
  { type: "HIGH_CASH_TRANSACTION", label: "High Cash Transaction", fields: ["amountThreshold"] },
  { type: "LARGE_TRANSACTION", label: "Large Transaction", fields: ["amountThreshold"] },
  { type: "DORMANT_ACCOUNT", label: "Dormant Account", fields: ["dormancyDays"] },
  { type: "REPAYMENT_OVERDUE", label: "EMI Overdue", fields: [] },
  { type: "BOUNCE_DETECTION", label: "EMI Bounce Detection", fields: [] },
  { type: "LOAN_DEFAULT", label: "Loan Default / NPA", fields: [] },
  { type: "CREDIT_SCORE_DROP", label: "Credit Score Drop", fields: ["dropThreshold"] },
  { type: "AML_CASE_OPENED", label: "AML Case Opened", fields: [] },
  { type: "FRAUD_CASE_OPENED", label: "Fraud Case Opened", fields: [] },
];

const FIELD_LABELS: Record<string, string> = {
  amountThreshold: "Amount threshold (₹)",
  dormancyDays: "Dormancy (days)",
  dropThreshold: "Drop threshold (points)",
};

export default function MonitoringRulesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ rules: RuleRow[] }>(["monitoring", "rules"], () => api("/api/monitoring/rules"));
  const [drafts, setDrafts] = useState<Record<string, { enabled: boolean; severity: string; config: Record<string, string> }>>({});

  const rulesByType = new Map((data?.rules ?? []).map((r) => [r.ruleType, r]));

  const draftFor = (ruleType: string, existing: RuleRow | undefined) => {
    if (drafts[ruleType]) return drafts[ruleType];
    return {
      enabled: existing?.enabled ?? true,
      severity: existing?.severity ?? "MEDIUM",
      config: Object.fromEntries(Object.entries(existing?.config ?? {}).map(([k, v]) => [k, String(v)])),
    };
  };

  const save = async (ruleType: string, label: string) => {
    const existing = rulesByType.get(ruleType);
    const draft = draftFor(ruleType, existing);
    try {
      await api("/api/monitoring/rules", {
        method: "PUT",
        body: JSON.stringify({
          ruleType,
          name: label,
          enabled: draft.enabled,
          severity: draft.severity,
          config: Object.fromEntries(Object.entries(draft.config).map(([k, v]) => [k, Number(v)])),
        }),
      });
      toast.success(`${label} rule saved`);
      qc.invalidate(["monitoring", "rules"]);
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Monitoring Rules</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Configure thresholds and severity per rule. Unconfigured rules run with sensible defaults.</p>

      {isLoading && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}

      <div style={{ display: "grid", gap: 12 }}>
        {RULE_TYPES.map((rt) => {
          const existing = rulesByType.get(rt.type);
          const draft = draftFor(rt.type, existing);
          return (
            <div key={rt.type} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600 }}>{rt.label}</h3>
                  {!existing && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Using built-in defaults — not yet configured</p>}
                </div>
                <StatusBadge status={draft.enabled ? "active" : "inactive"} customLabel={draft.enabled ? "Enabled" : "Disabled"} />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(e) => setDrafts((d) => ({ ...d, [rt.type]: { ...draft, enabled: e.target.checked } }))}
                  />
                  Enabled
                </label>
                <select
                  value={draft.severity}
                  onChange={(e) => setDrafts((d) => ({ ...d, [rt.type]: { ...draft, severity: e.target.value } }))}
                  style={selectStyle}
                >
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {rt.fields.map((f) => (
                  <input
                    key={f}
                    type="number"
                    placeholder={FIELD_LABELS[f]}
                    value={draft.config[f] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [rt.type]: { ...draft, config: { ...draft.config, [f]: e.target.value } } }))}
                    style={inputStyle}
                  />
                ))}
                <button onClick={() => save(rt.type, rt.label)} style={primaryBtn}>Save</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", fontSize: 13, color: "var(--text-primary)", width: 160 };
const selectStyle: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", fontSize: 13, color: "var(--text-primary)" };
const primaryBtn: React.CSSProperties = { padding: "8px 14px", background: "#6366f1", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" };
