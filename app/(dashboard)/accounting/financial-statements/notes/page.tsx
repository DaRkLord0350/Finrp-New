"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  RefreshCw, Plus, Save, Sparkles, X, Edit2, Check, FileText, BookOpen,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters/currency";

interface Report {
  id: string;
  name: string;
  status: string;
  periodStart: string;
  periodEnd: string;
}

interface NoteItem {
  label: string;
  currentAmount: number;
  comparativeAmount?: number;
}

interface Note {
  id: string;
  noteNumber: number;
  scheduleKey: string | null;
  title: string;
  content: string;
  items: NoteItem[];
  reportId: string;
}

interface Policy {
  id: string;
  title: string;
  content: string;
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  padding: "8px 12px",
  fontSize: 14,
  width: "100%",
  outline: "none",
};
const labelStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: 12,
  fontWeight: 500,
  marginBottom: 5,
  display: "block",
};

type Tab = "notes" | "policies";

export default function NotesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("notes");
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Notes add form
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteForm, setNoteForm] = useState({ noteNumber: "", scheduleKey: "", title: "", content: "" });
  const [savingNote, setSavingNote] = useState(false);
  const [aiGeneratingNote, setAiGeneratingNote] = useState<string | null>(null);

  // Note editing
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");

  // Policy editing
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [editPolicyContent, setEditPolicyContent] = useState("");
  const [editPolicyTitle, setEditPolicyTitle] = useState("");
  const [aiGenPolicies, setAiGenPolicies] = useState(false);
  const [savingPolicies, setSavingPolicies] = useState(false);

  // New policy form
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [policyForm, setPolicyForm] = useState({ title: "", content: "" });

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const res = await fetch("/api/financial-statements/reports");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load reports");
      const list: Report[] = json.reports ?? json ?? [];
      setReports(list);
      if (list.length > 0 && !selectedReportId) setSelectedReportId(list[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    } finally {
      setLoadingReports(false);
    }
  }, [selectedReportId]);

  const loadNotes = useCallback(async () => {
    if (!selectedReportId) return;
    setLoadingNotes(true);
    try {
      const res = await fetch(`/api/financial-statements/notes?reportId=${selectedReportId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load notes");
      setNotes(json.notes ?? json ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notes");
    } finally {
      setLoadingNotes(false);
    }
  }, [selectedReportId]);

  const loadPolicies = useCallback(async () => {
    setLoadingPolicies(true);
    try {
      const res = await fetch("/api/financial-statements/policies");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load policies");
      setPolicies(json.policies ?? json ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load policies");
    } finally {
      setLoadingPolicies(false);
    }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);
  useEffect(() => { if (activeTab === "notes" && selectedReportId) loadNotes(); }, [activeTab, selectedReportId, loadNotes]);
  useEffect(() => { if (activeTab === "policies") loadPolicies(); }, [activeTab, loadPolicies]);

  const addNote = async () => {
    if (!selectedReportId || !noteForm.title) { setError("Title is required."); return; }
    setSavingNote(true);
    setError(null);
    try {
      const res = await fetch("/api/financial-statements/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...noteForm, reportId: selectedReportId, noteNumber: Number(noteForm.noteNumber) || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save note");
      setShowNoteForm(false);
      setNoteForm({ noteNumber: "", scheduleKey: "", title: "", content: "" });
      setSuccess("Note saved.");
      await loadNotes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  const aiGenerateNote = async (noteId: string) => {
    if (!selectedReportId) return;
    setAiGeneratingNote(noteId);
    setError(null);
    try {
      const res = await fetch("/api/financial-statements/notes/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, reportId: selectedReportId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "AI generation failed");
      setSuccess("AI generated content for note.");
      await loadNotes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI generation failed");
    } finally {
      setAiGeneratingNote(null);
    }
  };

  const saveNoteEdit = async (noteId: string) => {
    try {
      const res = await fetch(`/api/financial-statements/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editNoteContent }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update");
      setEditingNoteId(null);
      setSuccess("Note updated.");
      await loadNotes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update note");
    }
  };

  const aiGeneratePolicies = async () => {
    setAiGenPolicies(true);
    setError(null);
    try {
      const res = await fetch("/api/financial-statements/policies/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessType: "Company", industry: "General" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "AI generation failed");
      setSuccess(`Generated ${json.generated ?? 0} policies.`);
      await loadPolicies();
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI policy generation failed");
    } finally {
      setAiGenPolicies(false);
    }
  };

  const savePolicyEdit = async (policyId: string) => {
    try {
      const res = await fetch(`/api/financial-statements/policies/${policyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editPolicyTitle, content: editPolicyContent }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update");
      setEditingPolicyId(null);
      setSuccess("Policy updated.");
      await loadPolicies();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update policy");
    }
  };

  const addPolicy = async () => {
    if (!policyForm.title) { setError("Policy title is required."); return; }
    setSavingPolicies(true);
    try {
      const res = await fetch("/api/financial-statements/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policyForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      setShowPolicyForm(false);
      setPolicyForm({ title: "", content: "" });
      setSuccess("Policy added.");
      await loadPolicies();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add policy");
    } finally {
      setSavingPolicies(false);
    }
  };

  const deletePolicy = async (policyId: string) => {
    try {
      const res = await fetch(`/api/financial-statements/policies/${policyId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to delete");
      await loadPolicies();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Notes & Accounting Policies</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 3 }}>Disclosures, schedules and significant accounting policies.</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}><X size={13} /></button>
        </div>
      )}
      {success && (
        <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8, padding: "10px 14px", color: "#10b981", fontSize: 13, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <Check size={14} /> <span style={{ flex: 1 }}>{success}</span>
          <button onClick={() => setSuccess(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#10b981" }}><X size={13} /></button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--bg-elevated)", borderRadius: 10, padding: 4, width: "fit-content", border: "1px solid var(--border)" }}>
        {([["notes", "Notes to Accounts", FileText], ["policies", "Accounting Policies", BookOpen]] as [Tab, string, React.ElementType][]).map(([tab, label, Icon]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 7, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
              background: activeTab === tab ? "var(--bg-card)" : "transparent",
              color: activeTab === tab ? "var(--text-primary)" : "var(--text-muted)",
              boxShadow: activeTab === tab ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1: Notes */}
      {activeTab === "notes" && (
        <div>
          {/* Report selector + action buttons */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
            {!loadingReports && (
              <select value={selectedReportId ?? ""} onChange={(e) => setSelectedReportId(e.target.value)}
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>
                <option value="">— Select Report —</option>
                {reports.map((r) => <option key={r.id} value={r.id}>{r.name || `Report ${r.id.slice(-6)}`}</option>)}
              </select>
            )}
            <button onClick={loadNotes} className="btn-ghost" style={{ padding: "8px 12px" }}>
              <RefreshCw size={14} style={loadingNotes ? { animation: "spin 1s linear infinite" } : {}} />
            </button>
            <button onClick={() => setShowNoteForm(true)} className="btn-brand" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> Add Note
            </button>
          </div>

          {/* Add Note Form */}
          {showNoteForm && (
            <div className="surface" style={{ padding: 20, marginBottom: 16, border: "1px solid var(--border-strong)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Add Note to Accounts</h3>
                <button onClick={() => setShowNoteForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={15} /></button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Note Number</label>
                  <input type="number" value={noteForm.noteNumber} onChange={(e) => setNoteForm({ ...noteForm, noteNumber: e.target.value })} placeholder="1" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Schedule Key</label>
                  <input value={noteForm.scheduleKey} onChange={(e) => setNoteForm({ ...noteForm, scheduleKey: e.target.value })} placeholder="e.g. equity-share-capital" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Title *</label>
                  <input value={noteForm.title} onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })} placeholder="e.g. Share Capital" style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Content / Disclosure</label>
                <textarea value={noteForm.content} onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })} placeholder="Write disclosure text here…" rows={4}
                  style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setShowNoteForm(false)} className="btn-ghost" style={{ padding: "8px 16px" }}>Cancel</button>
                <button onClick={addNote} disabled={savingNote} className="btn-brand" style={{ padding: "8px 16px", opacity: savingNote ? 0.6 : 1 }}>
                  {savingNote ? "Saving…" : "Save Note"}
                </button>
              </div>
            </div>
          )}

          {/* Notes list */}
          {loadingNotes ? (
            <div className="surface" style={{ padding: 48, textAlign: "center" }}>
              <div style={{ display: "inline-block", width: 22, height: 22, border: "2px solid var(--border)", borderTopColor: "var(--brand-400)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 10 }}>Loading notes…</p>
            </div>
          ) : notes.length === 0 ? (
            <div className="surface" style={{ padding: 48, textAlign: "center" }}>
              <FileText size={32} color="var(--text-muted)" style={{ marginBottom: 10 }} />
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                {selectedReportId ? "No notes yet for this report. Add the first one." : "Select a report to view notes."}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[...notes].sort((a, b) => a.noteNumber - b.noteNumber).map((note) => (
                <motion.div key={note.id} className="surface" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ overflow: "hidden" }}>
                  {/* Note header */}
                  <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, fontWeight: 700, color: "#6366f1" }}>
                      {note.noteNumber}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{note.title}</p>
                      {note.scheduleKey && (
                        <span style={{ fontSize: 11, color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "1px 7px", borderRadius: 5 }}>{note.scheduleKey}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => aiGenerateNote(note.id)} disabled={aiGeneratingNote === note.id} className="btn-ghost"
                        style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "5px 10px" }}>
                        <Sparkles size={12} color="#a78bfa" style={aiGeneratingNote === note.id ? { animation: "spin 1s linear infinite" } : {}} />
                        {aiGeneratingNote === note.id ? "Generating…" : "AI Generate"}
                      </button>
                      <button onClick={() => { setEditingNoteId(note.id); setEditNoteContent(note.content); }} className="btn-ghost"
                        style={{ padding: "5px 10px" }}>
                        <Edit2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Note content / edit */}
                  <div style={{ padding: "14px 18px" }}>
                    {editingNoteId === note.id ? (
                      <div>
                        <textarea value={editNoteContent} onChange={(e) => setEditNoteContent(e.target.value)} rows={5}
                          style={{ ...inputStyle, resize: "vertical", marginBottom: 10 }} />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => saveNoteEdit(note.id)} className="btn-brand" style={{ padding: "7px 14px", fontSize: 13 }}>
                            <Save size={12} style={{ marginRight: 5, display: "inline" }} />Save
                          </button>
                          <button onClick={() => setEditingNoteId(null)} className="btn-ghost" style={{ padding: "7px 12px", fontSize: 13 }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                        {note.content || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No content yet. Click Edit or AI Generate.</span>}
                      </p>
                    )}

                    {/* Items table */}
                    {note.items && note.items.length > 0 && (
                      <div style={{ marginTop: 14, overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: "var(--bg-elevated)" }}>
                              <th style={{ padding: "8px 12px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Particulars</th>
                              <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Current Year</th>
                              <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Previous Year</th>
                            </tr>
                          </thead>
                          <tbody>
                            {note.items.map((item, i) => (
                              <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                                <td style={{ padding: "7px 12px", color: "var(--text-secondary)" }}>{item.label}</td>
                                <td style={{ padding: "7px 12px", textAlign: "right", color: "var(--text-primary)", fontWeight: 500 }}>{formatCurrency(item.currentAmount)}</td>
                                <td style={{ padding: "7px 12px", textAlign: "right", color: "var(--text-muted)" }}>{item.comparativeAmount !== undefined ? formatCurrency(item.comparativeAmount) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Accounting Policies */}
      {activeTab === "policies" && (
        <div>
          {/* Actions */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
            <button onClick={loadPolicies} className="btn-ghost" style={{ padding: "8px 12px" }}>
              <RefreshCw size={14} style={loadingPolicies ? { animation: "spin 1s linear infinite" } : {}} />
            </button>
            <button onClick={aiGeneratePolicies} disabled={aiGenPolicies} className="btn-ghost"
              style={{ display: "flex", alignItems: "center", gap: 6, opacity: aiGenPolicies ? 0.7 : 1 }}>
              <Sparkles size={14} color="#a78bfa" style={aiGenPolicies ? { animation: "spin 1s linear infinite" } : {}} />
              {aiGenPolicies ? "Generating…" : "Generate AI Policies"}
            </button>
            <button onClick={() => setShowPolicyForm(true)} className="btn-brand" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> Add Policy
            </button>
          </div>

          {aiGenPolicies && (
            <div style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#a78bfa", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 16, height: 16, border: "2px solid rgba(167,139,250,0.3)", borderTopColor: "#a78bfa", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
              AI is generating standard accounting policies for your business type…
            </div>
          )}

          {/* Add Policy Form */}
          {showPolicyForm && (
            <div className="surface" style={{ padding: 20, marginBottom: 16, border: "1px solid var(--border-strong)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Add Accounting Policy</h3>
                <button onClick={() => setShowPolicyForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={15} /></button>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Policy Title *</label>
                <input value={policyForm.title} onChange={(e) => setPolicyForm({ ...policyForm, title: e.target.value })} placeholder="e.g. Revenue Recognition" style={inputStyle} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Policy Content</label>
                <textarea value={policyForm.content} onChange={(e) => setPolicyForm({ ...policyForm, content: e.target.value })} rows={5} placeholder="Describe the accounting policy…"
                  style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setShowPolicyForm(false)} className="btn-ghost" style={{ padding: "8px 16px" }}>Cancel</button>
                <button onClick={addPolicy} disabled={savingPolicies} className="btn-brand" style={{ padding: "8px 16px", opacity: savingPolicies ? 0.6 : 1 }}>
                  {savingPolicies ? "Saving…" : "Save Policy"}
                </button>
              </div>
            </div>
          )}

          {/* Policies list */}
          {loadingPolicies ? (
            <div className="surface" style={{ padding: 48, textAlign: "center" }}>
              <div style={{ display: "inline-block", width: 22, height: 22, border: "2px solid var(--border)", borderTopColor: "var(--brand-400)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 10 }}>Loading policies…</p>
            </div>
          ) : policies.length === 0 ? (
            <div className="surface" style={{ padding: 48, textAlign: "center" }}>
              <BookOpen size={32} color="var(--text-muted)" style={{ marginBottom: 10 }} />
              <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 12 }}>No accounting policies yet.</p>
              <button onClick={aiGeneratePolicies} className="btn-brand" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={14} /> Generate Standard Policies
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {policies.map((policy) => (
                <motion.div key={policy.id} className="surface" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ overflow: "hidden" }}>
                  <div style={{ padding: "12px 18px", borderBottom: editingPolicyId === policy.id ? "1px solid var(--border)" : "none", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {editingPolicyId === policy.id ? (
                        <input value={editPolicyTitle} onChange={(e) => setEditPolicyTitle(e.target.value)} style={{ ...inputStyle, fontSize: 14, fontWeight: 600, marginBottom: 0 }} />
                      ) : (
                        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{policy.title}</p>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {editingPolicyId !== policy.id ? (
                        <>
                          <button onClick={() => { setEditingPolicyId(policy.id); setEditPolicyTitle(policy.title); setEditPolicyContent(policy.content); }}
                            className="btn-ghost" style={{ padding: "5px 10px" }}>
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => deletePolicy(policy.id)} className="btn-ghost"
                            style={{ padding: "5px 10px", color: "#ef4444" }}>
                            <X size={13} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => savePolicyEdit(policy.id)} className="btn-brand" style={{ padding: "5px 12px", fontSize: 12 }}>
                            <Check size={12} style={{ marginRight: 4, display: "inline" }} />Save
                          </button>
                          <button onClick={() => setEditingPolicyId(null)} className="btn-ghost" style={{ padding: "5px 10px" }}>Cancel</button>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ padding: "12px 18px" }}>
                    {editingPolicyId === policy.id ? (
                      <textarea value={editPolicyContent} onChange={(e) => setEditPolicyContent(e.target.value)} rows={6}
                        style={{ ...inputStyle, resize: "vertical" }} />
                    ) : (
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                        {policy.content || <span style={{ fontStyle: "italic", color: "var(--text-muted)" }}>No content. Click edit to add.</span>}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
