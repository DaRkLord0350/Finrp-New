"use client";

import { use, useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@/lib/queryCache";
import { StatusBadge } from "@/components/ui/status-badge";

interface AlertRow { id: string; ruleType: string; severity: string; status: string; title: string; triggeredAt: string }
interface ActivityRow { id: string; activityType: string; notes: string | null; performedAt: string }
interface CaseDetail {
  id: string; caseNumber: string; subjectType: string; subjectLabel: string; status: string;
  openedAt: string; resolutionNotes: string | null;
  alerts: AlertRow[]; activities: ActivityRow[];
}

async function api(url: string, opts?: RequestInit) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export default function MonitoringCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ case: CaseDetail }>(["monitoring", "case", id], () => api(`/api/monitoring/cases/${id}`));
  const refresh = () => qc.invalidate(["monitoring", "case", id]);

  const [note, setNote] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");

  const escalate = async () => {
    try {
      await api(`/api/monitoring/cases/${id}`, { method: "PATCH", body: JSON.stringify({ action: "escalate", notes: note }) });
      toast.success("Case escalated");
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };
  const addNote = async () => {
    if (!note) return;
    try {
      await api(`/api/monitoring/cases/${id}/notes`, { method: "POST", body: JSON.stringify({ notes: note }) });
      setNote("");
      toast.success("Note added");
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };
  const resolve = async (resolution: "RESOLVED" | "CLOSED") => {
    if (!resolutionNotes) return toast.error("Resolution notes are required");
    try {
      await api(`/api/monitoring/cases/${id}`, { method: "PATCH", body: JSON.stringify({ action: "resolve", resolution, resolutionNotes }) });
      toast.success(`Case ${resolution.toLowerCase()}`);
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  if (isLoading || !data) return <p style={{ color: "var(--text-muted)" }}>Loading case…</p>;
  const kase = data.case;
  const isOpen = ["OPEN", "UNDER_REVIEW", "ESCALATED"].includes(kase.status);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{kase.caseNumber}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{kase.subjectType.replace(/_/g, " ")} — {kase.subjectLabel}</p>
        </div>
        <StatusBadge status={kase.status} size="md" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Alerts ({kase.alerts.length})</h3>
          {kase.alerts.map((a) => (
            <div key={a.id} style={{ padding: "8px 0", borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</span>
                <StatusBadge status={a.severity} />
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{a.ruleType.replace(/_/g, " ")} — {new Date(a.triggeredAt).toLocaleString("en-IN")}</p>
            </div>
          ))}
        </div>

        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Activity</h3>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" style={inputStyle} />
            <button onClick={addNote} style={secondaryBtn}>Add</button>
            {isOpen && <button onClick={escalate} style={secondaryBtn}>Escalate</button>}
          </div>
          {kase.activities.map((a) => (
            <div key={a.id} style={{ padding: "6px 0", borderTop: "1px solid var(--border)", fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600 }}>{a.activityType.replace(/_/g, " ")}</span>
                <span style={{ color: "var(--text-muted)" }}>{new Date(a.performedAt).toLocaleString("en-IN")}</span>
              </div>
              {a.notes && <p style={{ color: "var(--text-muted)", marginTop: 2 }}>{a.notes}</p>}
            </div>
          ))}
        </div>
      </div>

      {isOpen ? (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Resolve Case</h3>
          <textarea value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} placeholder="Resolution notes (required)…" style={{ ...inputStyle, width: "100%", minHeight: 60, marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => resolve("RESOLVED")} style={primaryBtn}>Resolve</button>
            <button onClick={() => resolve("CLOSED")} style={secondaryBtn}>Close (no action needed)</button>
          </div>
        </div>
      ) : (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Resolution</h3>
          <p style={{ fontSize: 13 }}>{kase.status} — {kase.resolutionNotes}</p>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = { flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", fontSize: 13, color: "var(--text-primary)" };
const primaryBtn: React.CSSProperties = { padding: "8px 14px", background: "#6366f1", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" };
const secondaryBtn: React.CSSProperties = { padding: "8px 14px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" };
