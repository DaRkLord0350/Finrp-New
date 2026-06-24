"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

export interface NoteRow {
  customerId: string;
  name: string;
  notes: string;
}

export default function WorkspaceNotes({ rows }: { rows: NoteRow[] }) {
  if (rows.length === 0) {
    return <p style={{ fontSize: 12.5, color: "var(--text-muted)", padding: "12px 0" }}>No clients assigned yet.</p>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
      {rows.map((r) => (
        <NoteCard key={r.customerId} row={r} />
      ))}
    </div>
  );
}

function NoteCard({ row }: { row: NoteRow }) {
  const [value, setValue] = useState(row.notes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = value !== row.notes;

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/ca/clients/${row.customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value }),
      });
      if (res.ok) {
        setSaved(true);
        row.notes = value;
        setTimeout(() => setSaved(false), 1500);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "12px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>{row.name}</p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder="Add a note…"
        style={{ width: "100%", padding: "8px 10px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12.5, outline: "none", resize: "vertical" }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button
          onClick={save}
          disabled={!dirty || saving}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7,
            border: "none", background: dirty ? "#6366f1" : "var(--border)", color: dirty ? "#fff" : "var(--text-muted)",
            fontSize: 12, fontWeight: 600, cursor: dirty && !saving ? "pointer" : "default",
          }}
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : null}
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}
