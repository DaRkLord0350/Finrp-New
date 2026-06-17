"use client";

import { useEffect, useState } from "react";
import { X, Repeat, Plus, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/formatters/date";

interface Schedule {
  id: string;
  frequency: string;
  nextRunDate: string;
  lastRunDate: string | null;
  isActive: boolean;
  createdAt: string;
}

const FREQUENCIES = ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"];

const inputStyle = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  padding: "9px 12px",
  fontSize: 14,
  width: "100%",
  outline: "none",
} as const;

export default function MakeRecurringModal({
  invoiceId,
  invoiceNumber,
  onClose,
  onChanged,
}: {
  invoiceId: string;
  invoiceNumber: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [frequency, setFrequency] = useState("MONTHLY");
  const [startDate, setStartDate] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [creating, setCreating] = useState(false);

  const fetchSchedules = async () => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/recurring`);
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setSchedules((data.schedules ?? []) as Schedule[]);
    } catch {
      /* non-critical */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    setCreating(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/recurring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frequency, startDate }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to create schedule");
      }
      const data = await res.json();
      setSchedules((prev) => [data.schedule as Schedule, ...prev]);
      toast.success("Recurring schedule created");
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create schedule");
    } finally {
      setCreating(false);
    }
  };

  const toggle = async (s: Schedule) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/recurring`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recurringId: s.id, isActive: !s.isActive }),
      });
      if (!res.ok) throw new Error("failed");
      setSchedules((prev) => prev.map((x) => (x.id === s.id ? { ...x, isActive: !x.isActive } : x)));
    } catch {
      toast.error("Couldn't update schedule");
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20, overflowY: "auto" }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
              <Repeat size={17} /> Recurring
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{invoiceNumber} · auto-generate on a schedule</p>
          </div>
          <button onClick={onClose} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 500, marginBottom: 6, display: "block" }}>Frequency</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)} style={inputStyle}>
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{f.charAt(0) + f.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 500, marginBottom: 6, display: "block" }}>First run</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <button onClick={create} disabled={creating} className="btn-brand" style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={15} /> {creating ? "Creating…" : "Create Schedule"}
          </button>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>Invoices are generated by a background worker on each run date.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {loading ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 16 }}>Loading…</p>
          ) : schedules.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 16 }}>No recurring schedule yet.</p>
          ) : (
            schedules.map((s) => (
              <div key={s.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, background: "var(--bg-elevated)", display: "flex", alignItems: "center", gap: 12, opacity: s.isActive ? 1 : 0.6 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{s.frequency.charAt(0) + s.frequency.slice(1).toLowerCase()}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Next run {formatDate(s.nextRunDate)}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: s.isActive ? "#10b981" : "#ef4444" }}>{s.isActive ? "Active" : "Paused"}</span>
                <button onClick={() => toggle(s)} className="btn-ghost" style={{ padding: "6px 10px", fontSize: 12 }}>
                  {s.isActive ? <Pause size={13} /> : <Play size={13} />} {s.isActive ? "Pause" : "Resume"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
