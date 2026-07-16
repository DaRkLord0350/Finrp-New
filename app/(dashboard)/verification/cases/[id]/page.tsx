"use client";

import { use, useState } from "react";
import { toast } from "sonner";
import { Bot } from "lucide-react";
import { useQuery, useQueryClient } from "@/lib/queryCache";
import { StatusBadge } from "@/components/ui/status-badge";

interface CheckRow {
  id: string;
  checkType: string;
  source: string;
  status: string;
  referenceId: string | null;
  resultSummary: Record<string, unknown> | null;
  failureReason: string | null;
  performedAt: string;
}
interface DocumentRow {
  id: string;
  docType: string;
  fileName: string;
  fileUrl: string;
  status: string;
  createdAt: string;
}
interface ActivityRow {
  id: string;
  activityType: string;
  notes: string | null;
  performedAt: string;
}
interface CaseDetail {
  id: string;
  caseNumber: string;
  subjectName: string;
  subjectType: string;
  status: string;
  resolutionNotes: string | null;
  openedAt: string;
  checks: CheckRow[];
  documents: DocumentRow[];
  activities: ActivityRow[];
  assignedTo: { id: string; name: string } | null;
}

async function api(url: string, opts?: RequestInit) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

const CHECK_TYPES: { type: string; label: string; fields: string[]; manual?: boolean }[] = [
  { type: "PAN", label: "PAN", fields: ["pan", "nameToMatch"] },
  { type: "GSTIN", label: "GSTIN", fields: ["gstin"] },
  { type: "CIN", label: "CIN", fields: ["cin"] },
  { type: "AADHAAR", label: "Aadhaar (Offline eKYC)", fields: ["offlineXmlBase64", "shareCode"] },
  { type: "BANK_ACCOUNT", label: "Bank Account", fields: ["accountNumber", "ifsc", "method", "nameToMatch"] },
  { type: "IFSC", label: "IFSC", fields: ["ifsc"] },
  { type: "DIRECTOR_DIN", label: "Director DIN", fields: ["din"] },
  { type: "CKYC", label: "CKYC", fields: ["pan", "ckycNumber"] },
  { type: "DRIVING_LICENSE", label: "Driving License", fields: ["documentNumber", "nameToMatch", "dob"] },
  { type: "PASSPORT", label: "Passport", fields: ["documentNumber", "nameToMatch", "dob"] },
  { type: "VOTER_ID", label: "Voter ID", fields: ["documentNumber", "nameToMatch"] },
  { type: "ADDRESS", label: "Address Cross-Check", fields: [] },
  { type: "PHONE", label: "Phone (OTP)", fields: ["phone"] },
  { type: "EMAIL", label: "Email (OTP)", fields: ["email"] },
  { type: "EMPLOYMENT", label: "Employment (Manual)", fields: [], manual: true },
  { type: "EDUCATION", label: "Education (Manual)", fields: [], manual: true },
  { type: "REFERENCE", label: "Reference (Manual)", fields: [], manual: true },
];

const FIELD_LABELS: Record<string, string> = {
  pan: "PAN", nameToMatch: "Name to match", gstin: "GSTIN", cin: "CIN", accountNumber: "Account number", ifsc: "IFSC",
  method: "Method (PENNY_DROP / PENNILESS_BAV)", din: "DIN", ckycNumber: "CKYC number", documentNumber: "Document number",
  dob: "DOB (YYYY-MM-DD)", phone: "Phone (+91...)", email: "Email",
  offlineXmlBase64: "Offline eKYC XML (base64)", shareCode: "Share code",
};

export default function VerificationCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ case: CaseDetail }>(["verification", "case", id], () => api(`/api/verification/cases/${id}`));
  const refresh = () => qc.invalidate(["verification", "case", id]);

  const [checkType, setCheckType] = useState("PAN");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [manualOutcome, setManualOutcome] = useState<"VERIFIED" | "FAILED">("VERIFIED");
  const [manualNotes, setManualNotes] = useState("");
  const [addrA, setAddrA] = useState({ source: "PAN_RECORD", address: "" });
  const [addrB, setAddrB] = useState({ source: "BANK_IFSC", address: "" });
  const [otpCodes, setOtpCodes] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [docType, setDocType] = useState("PAN");
  const [fileUrl, setFileUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const runCheck = async () => {
    setBusy(true);
    try {
      let body: Record<string, unknown>;
      if (checkType === "ADDRESS") {
        body = { checkType, sources: [addrA, addrB].filter((s) => s.address.trim()) };
      } else if (["EMPLOYMENT", "EDUCATION", "REFERENCE"].includes(checkType)) {
        body = { checkType, outcome: manualOutcome, notes: manualNotes };
      } else {
        body = { checkType, ...fields };
      }
      await api(`/api/verification/cases/${id}/checks`, { method: "POST", body: JSON.stringify(body) });
      toast.success(`${checkType.replace(/_/g, " ")} check recorded`);
      setFields({});
      setManualNotes("");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirmOtp = async (checkId: string) => {
    const code = otpCodes[checkId];
    if (!code) return toast.error("Enter the code");
    try {
      const res = await api(`/api/verification/cases/${id}/checks/${checkId}/confirm`, { method: "POST", body: JSON.stringify({ code }) });
      toast[res.result === "VERIFIED" ? "success" : "error"](`OTP ${res.result.toLowerCase()}`);
      setOtpCodes((f) => ({ ...f, [checkId]: "" }));
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const addNote = async () => {
    if (!note) return;
    try {
      await api(`/api/verification/cases/${id}/notes`, { method: "POST", body: JSON.stringify({ notes: note }) });
      setNote("");
      toast.success("Note added");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const uploadDocument = async () => {
    if (!fileUrl) return toast.error("Provide a file URL");
    try {
      await api(`/api/verification/cases/${id}/documents`, {
        method: "POST",
        body: JSON.stringify({ docType, fileName: fileUrl.split("/").pop() ?? "document", fileUrl, fileSize: 0, mimeType: "application/octet-stream" }),
      });
      setFileUrl("");
      toast.success("Document uploaded");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const setDocStatus = async (documentId: string, action: "verify" | "reject") => {
    try {
      await api(`/api/verification/cases/${id}/documents/${documentId}`, { method: "PATCH", body: JSON.stringify({ action }) });
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const finish = async (outcome: "COMPLETED" | "REJECTED") => {
    if (!resolutionNotes) return toast.error("Notes are required");
    try {
      await api(`/api/verification/cases/${id}`, { method: "PATCH", body: JSON.stringify({ action: "complete", outcome, notes: resolutionNotes }) });
      toast.success(`Case ${outcome.toLowerCase()}`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const summarize = async () => {
    try {
      const res = await api(`/api/verification/cases/${id}/summarize`, { method: "POST" });
      setSummary(res.summary);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (isLoading || !data) return <p style={{ color: "var(--text-muted)" }}>Loading case…</p>;
  const kase = data.case;
  const isOpen = ["OPEN", "IN_PROGRESS", "ON_HOLD"].includes(kase.status);
  const activeType = CHECK_TYPES.find((c) => c.type === checkType)!;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{kase.caseNumber}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{kase.subjectName} — {kase.subjectType.replace(/_/g, " ")}</p>
        </div>
        <StatusBadge status={kase.status} size="md" />
      </div>

      {isOpen && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Run a Check</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <select
              value={checkType}
              onChange={(e) => { setCheckType(e.target.value); setFields({}); }}
              style={{ ...inputStyle, flex: "0 0 220px" }}
            >
              {CHECK_TYPES.map((c) => <option key={c.type} value={c.type}>{c.label}</option>)}
            </select>
          </div>

          {checkType === "ADDRESS" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <input placeholder="Source A label" value={addrA.source} onChange={(e) => setAddrA((a) => ({ ...a, source: e.target.value }))} style={{ ...inputStyle, flex: "0 0 140px" }} />
                <input placeholder="Address A" value={addrA.address} onChange={(e) => setAddrA((a) => ({ ...a, address: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input placeholder="Source B label" value={addrB.source} onChange={(e) => setAddrB((a) => ({ ...a, source: e.target.value }))} style={{ ...inputStyle, flex: "0 0 140px" }} />
                <input placeholder="Address B" value={addrB.address} onChange={(e) => setAddrB((a) => ({ ...a, address: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
              </div>
            </div>
          ) : activeType.manual ? (
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <select value={manualOutcome} onChange={(e) => setManualOutcome(e.target.value as "VERIFIED" | "FAILED")} style={{ ...inputStyle, flex: "0 0 140px" }}>
                <option value="VERIFIED">Verified</option>
                <option value="FAILED">Failed</option>
              </select>
              <input placeholder="Notes" value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              {activeType.fields.map((f) => (
                <input
                  key={f}
                  placeholder={FIELD_LABELS[f] ?? f}
                  value={fields[f] ?? ""}
                  onChange={(e) => setFields((s) => ({ ...s, [f]: e.target.value }))}
                  style={{ ...inputStyle, flex: 1, minWidth: 160 }}
                />
              ))}
            </div>
          )}

          <button onClick={runCheck} disabled={busy} style={primaryBtn}>{busy ? "Running…" : "Run Check"}</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Checks ({kase.checks.length})</h3>
            <button onClick={summarize} style={secondaryBtn}><Bot size={13} /> AI Summarize</button>
          </div>
          {summary && <p style={{ fontSize: 13, marginBottom: 10, padding: 10, background: "var(--bg-base)", borderRadius: 8 }}>{summary}</p>}
          {kase.checks.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No checks run yet.</p>}
          {kase.checks.map((c) => (
            <div key={c.id} style={{ padding: "8px 0", borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{c.checkType.replace(/_/g, " ")}</span>
                <StatusBadge status={c.status} />
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                {c.source.replace(/_/g, " ")} — {new Date(c.performedAt).toLocaleString("en-IN")}
              </p>
              {c.failureReason && <p style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>{c.failureReason}</p>}
              {(c.checkType === "PHONE" || c.checkType === "EMAIL") && c.status === "PENDING" && (
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <input
                    placeholder="Enter code"
                    value={otpCodes[c.id] ?? ""}
                    onChange={(e) => setOtpCodes((s) => ({ ...s, [c.id]: e.target.value }))}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={() => confirmOtp(c.id)} style={secondaryBtn}>Confirm</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Activity</h3>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" style={inputStyle} />
            <button onClick={addNote} style={secondaryBtn}>Add</button>
          </div>
          {kase.activities.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No activity yet.</p>}
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

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Document Repository</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <select value={docType} onChange={(e) => setDocType(e.target.value)} style={{ ...inputStyle, flex: "0 0 180px" }}>
            {["PAN", "GSTIN", "CIN", "AADHAAR", "DRIVING_LICENSE", "PASSPORT", "VOTER_ID", "BANK_ACCOUNT"].map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select>
          <input placeholder="File URL" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <button onClick={uploadDocument} style={primaryBtn}>Upload</button>
        </div>
        {kase.documents.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No documents uploaded yet.</p>}
        {kase.documents.map((d) => (
          <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--border)" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600 }}>{d.docType.replace(/_/g, " ")}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.fileName}</p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <StatusBadge status={d.status} />
              {d.status === "PENDING" && (
                <>
                  <button onClick={() => setDocStatus(d.id, "verify")} style={secondaryBtn}>Verify</button>
                  <button onClick={() => setDocStatus(d.id, "reject")} style={secondaryBtn}>Reject</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {isOpen ? (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Complete Case</h3>
          <textarea value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} placeholder="Notes (required)…" style={{ ...inputStyle, width: "100%", minHeight: 60, marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => finish("COMPLETED")} style={primaryBtn}>Complete Case</button>
            <button onClick={() => finish("REJECTED")} style={dangerBtn}>Reject Case</button>
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

const inputStyle: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", fontSize: 13, color: "var(--text-primary)" };
const primaryBtn: React.CSSProperties = { padding: "8px 14px", background: "#6366f1", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" };
const secondaryBtn: React.CSSProperties = { padding: "8px 14px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" };
const dangerBtn: React.CSSProperties = { padding: "8px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#ef4444", cursor: "pointer" };
