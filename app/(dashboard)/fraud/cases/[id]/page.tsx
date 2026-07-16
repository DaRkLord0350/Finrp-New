"use client";

import { use, useState } from "react";
import { toast } from "sonner";
import { Bot } from "lucide-react";
import { useQuery, useQueryClient } from "@/lib/queryCache";
import { StatusBadge } from "@/components/ui/status-badge";

interface Alert { id: string; alertType: string; severity: string; description: string; status: string }
interface Activity { id: string; activityType: string; notes: string | null; performedAt: string }
interface CaseDetail {
  id: string; caseNumber: string; subjectName: string; status: string; riskRating: string;
  openedAt: string; resolution: string | null; resolutionNotes: string | null;
  alerts: Alert[]; activities: Activity[];
}

async function api(url: string, opts?: RequestInit) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export default function FraudCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ case: CaseDetail }>(["fraud", "case", id], () => api(`/api/fraud/cases/${id}`));
  const refresh = () => qc.invalidate(["fraud", "case", id]);

  const [note, setNote] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const escalate = async () => {
    try { await api(`/api/fraud/cases/${id}`, { method: "PATCH", body: JSON.stringify({ action: "escalate", notes: note }) }); toast.success("Case escalated"); refresh(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const addNote = async () => {
    if (!note) return;
    try { await api(`/api/fraud/cases/${id}/notes`, { method: "POST", body: JSON.stringify({ notes: note }) }); setNote(""); toast.success("Note added"); refresh(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const resolve = async (resolution: "CLEARED" | "FALSE_POSITIVE" | "CONFIRMED_FRAUD") => {
    if (!resolutionNotes) return toast.error("Resolution notes are required");
    try {
      await api(`/api/fraud/cases/${id}`, { method: "PATCH", body: JSON.stringify({ action: "resolve", resolution, resolutionNotes }) });
      toast.success(`Case resolved: ${resolution}`);
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };
  const summarize = async () => {
    try { const res = await api(`/api/fraud/cases/${id}/summarize`, { method: "POST" }); setSummary(res.summary); }
    catch (e) { toast.error((e as Error).message); }
  };

  if (isLoading || !data) return <p style={{ color: "var(--text-muted)" }}>Loading case…</p>;
  const fraudCase = data.case;
  const isOpen = ["OPEN", "UNDER_REVIEW", "ESCALATED"].includes(fraudCase.status);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{fraudCase.caseNumber}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{fraudCase.subjectName}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <StatusBadge status={fraudCase.riskRating} size="md" />
          <StatusBadge status={fraudCase.status} size="md" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Indicators</h3>
            <button onClick={summarize} style={secondaryBtn}><Bot size={13} /> AI Summarize</button>
          </div>
          {summary && <p style={{ fontSize: 13, marginBottom: 10, padding: 10, background: "var(--bg-base)", borderRadius: 8 }}>{summary}</p>}
          {fraudCase.alerts.map((a) => (
            <div key={a.id} style={{ padding: "8px 0", borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{a.alertType.replace(/_/g, " ")}</span>
                <StatusBadge status={a.severity} />
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{a.description}</p>
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
          {fraudCase.activities.map((a) => (
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
            <button onClick={() => resolve("CLEARED")} style={primaryBtn}>Clear Case</button>
            <button onClick={() => resolve("FALSE_POSITIVE")} style={secondaryBtn}>Mark False Positive</button>
            <button onClick={() => resolve("CONFIRMED_FRAUD")} style={dangerBtn}>Confirm Fraud</button>
          </div>
        </div>
      ) : (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Resolution</h3>
          <p style={{ fontSize: 13 }}>{fraudCase.resolution} — {fraudCase.resolutionNotes}</p>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = { flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", fontSize: 13, color: "var(--text-primary)" };
const primaryBtn: React.CSSProperties = { padding: "8px 14px", background: "#6366f1", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" };
const secondaryBtn: React.CSSProperties = { padding: "8px 14px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" };
const dangerBtn: React.CSSProperties = { padding: "8px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#ef4444", cursor: "pointer" };
