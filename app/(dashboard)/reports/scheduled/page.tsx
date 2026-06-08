"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Plus, Trash2, Mail } from "lucide-react";
import { REPORTS } from "@/lib/reports/registry";

interface ScheduledReport {
  id:              string;
  reportSlug:      string;
  name:            string;
  frequency:       string;
  emailRecipients: string[];
  nextRunAt:       string;
  lastRunAt:       string | null;
  enabled:         boolean;
}

export default function ScheduledReportsPage() {
  const [scheduled, setScheduled] = useState<ScheduledReport[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [form, setForm] = useState({
    reportSlug:      "",
    name:            "",
    frequency:       "weekly",
    emailRecipients: "",
  });

  useEffect(() => {
    fetch("/api/reports/scheduled")
      .then((r) => r.json())
      .then((d) => setScheduled(d.scheduled ?? []))
      .finally(() => setLoading(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/reports/scheduled", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        emailRecipients: form.emailRecipients.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    });
    if (res.ok) {
      const item = await res.json();
      setScheduled((prev) => [item, ...prev]);
      setShowForm(false);
      setForm({ reportSlug: "", name: "", frequency: "weekly", emailRecipients: "" });
    }
  };

  return (
    <div style={{ padding: "24px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Scheduled Reports</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Auto-email reports on a schedule</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary"
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
        >
          <Plus size={14} />
          Schedule Report
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background:   "var(--bg-surface)",
            border:       "1px solid var(--border)",
            borderRadius: 12,
            padding:      "20px 24px",
            marginBottom: 20,
            display:      "flex",
            flexDirection: "column",
            gap:          14,
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>New Scheduled Report</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Report</label>
              <select
                required
                value={form.reportSlug}
                onChange={(e) => setForm((f) => ({ ...f, reportSlug: e.target.value, name: REPORTS.find((r) => r.slug === e.target.value)?.name ?? "" }))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-muted)", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
              >
                <option value="">Select report…</option>
                {REPORTS.filter((r) => r.enabled).map((r) => (
                  <option key={r.slug} value={r.slug}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Frequency</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-muted)", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Email Recipients (comma-separated)</label>
            <input
              required
              type="text"
              value={form.emailRecipients}
              onChange={(e) => setForm((f) => ({ ...f, emailRecipients: e.target.value }))}
              placeholder="email@example.com, another@example.com"
              style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-muted)", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="btn-primary" style={{ fontSize: 13 }}>Create Schedule</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost" style={{ fontSize: 13 }}>Cancel</button>
          </div>
        </motion.form>
      )}

      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</div>
      ) : scheduled.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: 14 }}>No scheduled reports yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {scheduled.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              style={{
                background:   "var(--bg-surface)",
                border:       "1px solid var(--border)",
                borderRadius: 10,
                padding:      "14px 18px",
                display:      "flex",
                alignItems:   "center",
                gap:          16,
              }}
            >
              <Clock size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-primary)" }}>{s.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {s.frequency.charAt(0).toUpperCase() + s.frequency.slice(1)} · Next: {new Date(s.nextRunAt).toLocaleDateString("en-IN")}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
                <Mail size={13} />
                {s.emailRecipients.length} recipient{s.emailRecipients.length !== 1 ? "s" : ""}
              </div>
              <span
                style={{
                  display:      "inline-block",
                  padding:      "2px 8px",
                  borderRadius: 20,
                  fontSize:     11,
                  fontWeight:   600,
                  background:   s.enabled ? "#d1fae5" : "#f3f4f6",
                  color:        s.enabled ? "#059669" : "#6b7280",
                }}
              >
                {s.enabled ? "Active" : "Paused"}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
