"use client";

import { useRef, useState } from "react";
import { Paperclip, X, FileText, UploadCloud } from "lucide-react";
import type { InvoiceFormApi } from "../hooks/use-invoice-form";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsSection({ form }: { form: InvoiceFormApi }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="surface" style={{ padding: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
        <Paperclip size={15} /> Attachments
      </h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>Files are uploaded once the invoice is saved. Max 20 MB each.</p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) form.addAttachments(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        style={{
          border: `1.5px dashed ${dragOver ? "#818cf8" : "var(--border-strong)"}`,
          background: dragOver ? "rgba(99,102,241,0.06)" : "var(--bg-elevated)",
          borderRadius: 10,
          padding: "20px 16px",
          textAlign: "center",
          cursor: "pointer",
          transition: "all 0.15s",
        }}
      >
        <UploadCloud size={22} style={{ color: dragOver ? "#818cf8" : "var(--text-muted)", marginBottom: 6 }} />
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          <span style={{ color: "#818cf8", fontWeight: 600 }}>Click to upload</span> or drag &amp; drop
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => { if (e.target.files?.length) form.addAttachments(e.target.files); e.target.value = ""; }}
        />
      </div>

      {form.attachments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          {form.attachments.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8 }}>
              {a.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.previewUrl} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 6, background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <FileText size={16} style={{ color: "#818cf8" }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.file.name}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{humanSize(a.file.size)}</p>
              </div>
              <button type="button" onClick={() => form.removeAttachment(a.id)} aria-label="Remove attachment" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
