"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  FolderOpen,
  Upload,
  Download,
  Trash2,
  FilePlus2,
  Lock,
  History,
} from "lucide-react";
import {
  Modal,
  labelStyle,
  inputStyle,
  fieldGap,
  primaryBtnStyle,
  secondaryBtnStyle,
} from "@/components/firm/team/Modal";
import {
  DOCUMENT_FOLDERS,
  FOLDER_LABELS,
  FOLDER_COLORS,
  MAX_INLINE_BYTES,
} from "@/lib/vault/constants";
import type { DocumentFolder } from "@prisma/client";

interface VaultDoc {
  id: string;
  folder: DocumentFolder;
  displayName: string;
  fileName: string;
  fileSize: number;
  currentVersion: number;
  isConfidential: boolean;
  notes: string | null;
  updatedAt: string;
  _count: { versions: number; downloads: number };
}

interface FilePayload {
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string | null;
}

function fmtSize(b: number) {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

export function CustomerVault({ customerId }: { customerId: string }) {
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState<DocumentFolder | "ALL">("ALL");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [versionTarget, setVersionTarget] = useState<VaultDoc | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/firm/vault?customerId=${customerId}`);
      const data = await res.json();
      setDocs(data.documents ?? []);
    } catch {
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  async function download(doc: VaultDoc) {
    try {
      const res = await fetch(`/api/firm/vault/${doc.id}/download`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const a = document.createElement("a");
      a.href = data.fileUrl;
      a.download = data.fileName ?? doc.fileName;
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  }

  async function remove(doc: VaultDoc) {
    if (!confirm(`Delete "${doc.displayName}" and all its versions?`)) return;
    try {
      const res = await fetch(`/api/firm/vault/${doc.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed");
      toast.success("Document deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const shown = folder === "ALL" ? docs : docs.filter((d) => d.folder === folder);
  const folderCounts = docs.reduce<Record<string, number>>((acc, d) => {
    acc[d.folder] = (acc[d.folder] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
        <FolderOpen size={16} color="#0ea5e9" />
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Document Vault</h2>
        <button
          onClick={() => setUploadOpen(true)}
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 12px",
            background: "#6366f1",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Upload size={13} /> Upload
        </button>
      </div>

      {/* Folder filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "12px 20px", borderBottom: "1px solid var(--border)" }}>
        <FolderChip label={`All (${docs.length})`} active={folder === "ALL"} color="#6366f1" onClick={() => setFolder("ALL")} />
        {DOCUMENT_FOLDERS.filter((f) => folderCounts[f]).map((f) => (
          <FolderChip
            key={f}
            label={`${FOLDER_LABELS[f]} (${folderCounts[f]})`}
            active={folder === f}
            color={FOLDER_COLORS[f]}
            onClick={() => setFolder(f)}
          />
        ))}
      </div>

      {loading ? (
        <div className="empty-state" style={{ padding: "28px" }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading…</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty-state" style={{ padding: "28px 20px" }}>
          <FolderOpen size={34} color="var(--text-muted)" />
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No documents in this view.</p>
        </div>
      ) : (
        <div>
          {shown.map((d, i) => (
            <div
              key={d.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 20px",
                borderTop: i === 0 ? "none" : "1px solid var(--border)",
                flexWrap: "wrap",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 2, background: FOLDER_COLORS[d.folder], flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 160 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                  {d.displayName}
                  {d.isConfidential && <Lock size={11} color="#ef4444" />}
                </p>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {FOLDER_LABELS[d.folder]} · v{d.currentVersion} · {fmtSize(d.fileSize)} · {d._count.downloads} download
                  {d._count.downloads !== 1 ? "s" : ""}
                </p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <IconBtn title="Download" onClick={() => download(d)}>
                  <Download size={14} />
                </IconBtn>
                <IconBtn title="New version" onClick={() => setVersionTarget(d)}>
                  <FilePlus2 size={14} />
                </IconBtn>
                <IconBtn title="Delete" danger onClick={() => remove(d)}>
                  <Trash2 size={14} />
                </IconBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      {uploadOpen && (
        <UploadModal
          customerId={customerId}
          onClose={() => setUploadOpen(false)}
          onSaved={() => {
            setUploadOpen(false);
            load();
          }}
        />
      )}
      {versionTarget && (
        <VersionModal
          doc={versionTarget}
          onClose={() => setVersionTarget(null)}
          onSaved={() => {
            setVersionTarget(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function FolderChip({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 10px",
        borderRadius: 99,
        border: `1px solid ${active ? color : "var(--border)"}`,
        background: active ? `${color}18` : "transparent",
        color: active ? color : "var(--text-secondary)",
        fontSize: 11.5,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        width: 30,
        height: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: 7,
        cursor: "pointer",
        color: danger ? "#ef4444" : "var(--text-secondary)",
      }}
    >
      {children}
    </button>
  );
}

// ── File picker shared by upload + version modals ───────────────
function FilePicker({ onPicked, payload }: { onPicked: (p: FilePayload | null) => void; payload: FilePayload | null }) {
  const ref = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");

  async function pick(file: File) {
    if (file.size <= MAX_INLINE_BYTES) {
      const dataUrl = await readFile(file);
      onPicked({ fileName: file.name, fileUrl: dataUrl, fileSize: file.size, mimeType: file.type || null });
    } else {
      // Too large to inline — keep metadata, require a hosted URL.
      onPicked({ fileName: file.name, fileUrl: "", fileSize: file.size, mimeType: file.type || null });
      toast.message("Large file — paste a hosted URL below");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          padding: "14px",
          border: "1.5px dashed var(--border)",
          borderRadius: 10,
          background: "var(--bg-base)",
          cursor: "pointer",
          color: "var(--text-secondary)",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <Upload size={16} /> {payload?.fileName ?? "Choose file"}
      </button>
      <input
        ref={ref}
        type="file"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = "";
        }}
      />
      {payload && !payload.fileUrl && (
        <input
          style={{ ...inputStyle, marginTop: 8 }}
          placeholder="Hosted file URL (https://…)"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            onPicked({ ...payload, fileUrl: e.target.value.trim() });
          }}
        />
      )}
      {payload && (
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
          {payload.fileName} · {fmtSize(payload.fileSize)}
        </p>
      )}
    </div>
  );
}

function UploadModal({ customerId, onClose, onSaved }: { customerId: string; onClose: () => void; onSaved: () => void }) {
  const [folder, setFolder] = useState<DocumentFolder>("GST");
  const [displayName, setDisplayName] = useState("");
  const [payload, setPayload] = useState<FilePayload | null>(null);
  const [confidential, setConfidential] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!displayName.trim()) return toast.error("Display name is required");
    if (!payload?.fileUrl) return toast.error("Choose a file or paste a URL");
    setBusy(true);
    try {
      const res = await fetch("/api/firm/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          folder,
          displayName: displayName.trim(),
          fileName: payload.fileName,
          fileUrl: payload.fileUrl,
          fileSize: payload.fileSize,
          mimeType: payload.mimeType,
          isConfidential: confidential,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      toast.success("Document uploaded");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Upload Document" subtitle="Stored against this customer's vault" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, ...fieldGap }}>
        <div>
          <label style={labelStyle}>Folder *</label>
          <select style={inputStyle} value={folder} onChange={(e) => setFolder(e.target.value as DocumentFolder)}>
            {DOCUMENT_FOLDERS.map((f) => (
              <option key={f} value={f}>
                {FOLDER_LABELS[f]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Display Name *</label>
          <input style={inputStyle} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="GSTR-3B Apr 2026" />
        </div>
      </div>

      <div style={fieldGap}>
        <label style={labelStyle}>File *</label>
        <FilePicker payload={payload} onPicked={setPayload} />
      </div>

      <div style={fieldGap}>
        <label style={labelStyle}>Notes</label>
        <input style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer", ...fieldGap }}>
        <input type="checkbox" checked={confidential} onChange={(e) => setConfidential(e.target.checked)} style={{ width: 15, height: 15, accentColor: "#6366f1" }} />
        Mark as confidential (firm-only)
      </label>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
        <button onClick={submit} disabled={busy} style={primaryBtnStyle(busy)}>
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>
    </Modal>
  );
}

function VersionModal({ doc, onClose, onSaved }: { doc: VaultDoc; onClose: () => void; onSaved: () => void }) {
  const [payload, setPayload] = useState<FilePayload | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!payload?.fileUrl) return toast.error("Choose a file or paste a URL");
    setBusy(true);
    try {
      const res = await fetch(`/api/firm/vault/${doc.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl: payload.fileUrl,
          fileName: payload.fileName,
          fileSize: payload.fileSize,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success(`Version ${data.version} added`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New Version" subtitle={`${doc.displayName} · currently v${doc.currentVersion}`} onClose={onClose}>
      <div style={fieldGap}>
        <label style={labelStyle}><History size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />Replacement file *</label>
        <FilePicker payload={payload} onPicked={setPayload} />
      </div>
      <div style={fieldGap}>
        <label style={labelStyle}>Version notes</label>
        <input style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What changed?" />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
        <button onClick={submit} disabled={busy} style={primaryBtnStyle(busy)}>
          {busy ? "Saving…" : "Add Version"}
        </button>
      </div>
    </Modal>
  );
}
