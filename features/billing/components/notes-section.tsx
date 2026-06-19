"use client";

import { Plus, X } from "lucide-react";
import type { InvoiceFormApi } from "../hooks/use-invoice-form";

export function NotesSection({ form }: { form: InvoiceFormApi }) {
  return (
    <div className="surface" style={{ padding: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Notes &amp; Details</h3>

      <div style={{ marginBottom: 16 }}>
        <label className="label">Customer Notes</label>
        <textarea
          className="input"
          rows={2}
          value={form.notes}
          onChange={(e) => form.setNotes(e.target.value)}
          placeholder="Thank-you note or payment instructions — shown on the invoice"
          style={{ resize: "vertical", fontFamily: "inherit" }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="label">Internal Notes (private — never on the PDF or public link)</label>
        <textarea
          className="input"
          rows={2}
          value={form.internalNotes}
          onChange={(e) => form.setInternalNotes(e.target.value)}
          placeholder="Visible only to your team"
          style={{ resize: "vertical", fontFamily: "inherit" }}
        />
      </div>

      <div>
        <label className="label">Custom Fields</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {form.customFields.map((f, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 34px", gap: 8 }}>
              <input className="input" placeholder="Label (e.g. PO Number)" value={f.label} onChange={(e) => form.setCustomField(idx, "label", e.target.value)} />
              <input className="input" placeholder="Value" value={f.value} onChange={(e) => form.setCustomField(idx, "value", e.target.value)} />
              <button type="button" onClick={() => form.removeCustomField(idx)} aria-label="Remove field" style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={14} />
              </button>
            </div>
          ))}
          <button type="button" onClick={form.addCustomField} className="btn-ghost" style={{ alignSelf: "flex-start", fontSize: 13, gap: 6 }}>
            <Plus size={14} /> Add custom field
          </button>
        </div>
      </div>
    </div>
  );
}
