"use client";

import { Repeat } from "lucide-react";
import type { InvoiceFormApi } from "../hooks/use-invoice-form";
import type { RecurringConfig } from "../types";

const FREQUENCIES: Array<{ value: RecurringConfig["frequency"]; label: string }> = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
  { value: "CUSTOM", label: "Custom" },
];

export function RecurringSection({ form }: { form: InvoiceFormApi }) {
  const r = form.recurring;
  const update = (patch: Partial<RecurringConfig>) => form.setRecurring({ ...r, ...patch });

  return (
    <div className="surface" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: r.enabled ? 16 : 0 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
          <Repeat size={15} /> Recurring Invoice
        </h3>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12.5, color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={r.enabled} onChange={(e) => update({ enabled: e.target.checked })} style={{ accentColor: "#6366f1" }} />
          Auto-generate on a schedule
        </label>
      </div>

      {r.enabled && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label className="label">Frequency</label>
              <select className="input" value={r.frequency} onChange={(e) => update({ frequency: e.target.value as RecurringConfig["frequency"] })}>
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            {r.frequency === "CUSTOM" && (
              <div>
                <label className="label">Every (days)</label>
                <input type="number" className="input" min={1} value={r.customIntervalDays} onChange={(e) => update({ customIntervalDays: parseInt(e.target.value) || 1 })} />
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="label">Start Date</label>
              <input type="date" className="input" value={r.startDate} onChange={(e) => update({ startDate: e.target.value })} />
            </div>
            <div>
              <label className="label">End Date (optional)</label>
              <input type="date" className="input" value={r.endDate} min={r.startDate} onChange={(e) => update({ endDate: e.target.value })} />
            </div>
          </div>

          <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 12 }}>
            A draft invoice is generated automatically on each run date (processed hourly). Leave the end date blank to repeat indefinitely.
          </p>
        </>
      )}
    </div>
  );
}
