"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Modal, primaryBtnStyle, secondaryBtnStyle } from "./Modal";
import type { ImportParsedRow, ImportRowError } from "./types";

interface Props {
  onClose: () => void;
  onImported: () => void;
}

type Step = "upload" | "preview" | "done";

export function ImportModal({ onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [valid, setValid] = useState<ImportParsedRow[]>([]);
  const [errors, setErrors] = useState<ImportRowError[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/firm/team/import", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not read file");
      setValid(data.valid ?? []);
      setErrors(data.errors ?? []);
      setStep("preview");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to read file");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    setBusy(true);
    try {
      const res = await fetch("/api/firm/team/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: valid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult({ created: data.created ?? 0, skipped: data.skipped ?? 0 });
      setStep("done");
      onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Import Team Members" subtitle="Bulk-add members from an Excel (.xlsx) file" onClose={onClose} maxWidth={640}>
      {step === "upload" && (
        <>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/api/firm/team/import/template";
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              background: "var(--bg-base)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
              marginBottom: 16,
            }}
          >
            <Download size={18} color="#6366f1" />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Download sample template</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Columns: name, email, phone, role, specialization
              </p>
            </div>
          </button>

          <div
            onClick={() => fileRef.current?.click()}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "32px 16px",
              border: "1.5px dashed var(--border)",
              borderRadius: 12,
              cursor: "pointer",
              background: "var(--bg-base)",
            }}
          >
            <Upload size={28} color="var(--text-muted)" />
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              {busy ? "Reading…" : "Click to upload .xlsx"}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Max 2MB · first sheet is used</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </>
      )}

      {step === "preview" && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <Stat icon={<CheckCircle2 size={16} color="#10b981" />} label="Valid" value={valid.length} color="#10b981" />
            <Stat icon={<AlertTriangle size={16} color="#ef4444" />} label="Errors" value={errors.length} color="#ef4444" />
          </div>

          {valid.length > 0 && (
            <PreviewTable
              title="Will be imported"
              rows={valid.slice(0, 50).map((r) => ({
                cols: [r.name, r.email, r.firmRole, r.specialization ?? "—"],
                tone: "ok" as const,
              }))}
              headers={["Name", "Email", "Role", "Specialization"]}
            />
          )}

          {errors.length > 0 && (
            <PreviewTable
              title="Skipped (fix and re-upload)"
              rows={errors.slice(0, 50).map((e) => ({
                cols: [`Row ${e.row}: ${e.data.name || "—"}`, e.data.email || "—", e.errors.join("; ")],
                tone: "err" as const,
              }))}
              headers={["Row", "Email", "Problem"]}
            />
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button onClick={() => setStep("upload")} style={secondaryBtnStyle}>
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={busy || valid.length === 0}
              style={primaryBtnStyle(busy || valid.length === 0)}
            >
              {busy ? "Importing…" : `Import ${valid.length} member${valid.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </>
      )}

      {step === "done" && result && (
        <div style={{ textAlign: "center", padding: "16px 8px" }}>
          <FileSpreadsheet size={40} color="#10b981" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Import complete</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
            {result.created} invite{result.created !== 1 ? "s" : ""} created
            {result.skipped > 0 ? ` · ${result.skipped} skipped` : ""}.
          </p>
          <button onClick={onClose} style={{ ...primaryBtnStyle(false, 1), marginTop: 20, width: "100%" }}>
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}

function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        background: "var(--bg-base)",
        border: "1px solid var(--border)",
        borderRadius: 10,
      }}
    >
      {icon}
      <div>
        <p style={{ fontSize: 18, fontWeight: 700, color }}>{value}</p>
        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</p>
      </div>
    </div>
  );
}

function PreviewTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: { cols: string[]; tone: "ok" | "err" }[];
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>{title}</p>
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 10,
          overflow: "hidden",
          maxHeight: 220,
          overflowY: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--bg-base)" }}>
              {headers.map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-muted)", fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                {r.cols.map((c, j) => (
                  <td
                    key={j}
                    style={{
                      padding: "7px 10px",
                      color: r.tone === "err" && j === r.cols.length - 1 ? "#ef4444" : "var(--text-secondary)",
                    }}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
