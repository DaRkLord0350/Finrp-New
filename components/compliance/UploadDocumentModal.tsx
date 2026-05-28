"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { X, Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";

interface Props {
  submissionId: string;
  submissionTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp", "xls", "xlsx", "doc", "docx", "zip"];

export default function UploadDocumentModal({
  submissionId,
  submissionTitle,
  onClose,
  onSuccess,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (f: File): string | null => {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `File type ".${ext}" is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`;
    }
    if (f.size > 20 * 1024 * 1024) {
      return "File size exceeds 20 MB limit";
    }
    return null;
  };

  const handleFile = (f: File) => {
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setFile(f);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (documentType) form.append("documentType", documentType);
      if (description) form.append("description", description);

      const res = await fetch(`/api/compliance/submissions/${submissionId}/documents`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Upload failed");
      }
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 500,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
              Upload Document
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {submissionTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: 6,
              borderRadius: 8,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px 24px" }}>
          {success ? (
            <div
              style={{
                textAlign: "center",
                padding: "24px 0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              <CheckCircle size={40} color="#10b981" />
              <p style={{ color: "#10b981", fontWeight: 600, fontSize: 15 }}>
                Document uploaded successfully
              </p>
            </div>
          ) : (
            <>
              {/* Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => inputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? "var(--brand-500)" : "var(--border)"}`,
                  borderRadius: 12,
                  padding: "28px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: dragOver ? "rgba(99,102,241,0.05)" : "var(--bg-elevated)",
                  transition: "all 0.2s",
                  marginBottom: 16,
                }}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.doc,.docx,.zip"
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                {file ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <FileText size={28} color="var(--brand-500)" />
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                      {file.name}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {formatSize(file.size)}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      style={{
                        fontSize: 11,
                        color: "#ef4444",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <Upload size={28} color="var(--text-muted)" />
                    <p style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 500 }}>
                      Drop file here or click to browse
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      PDF, Word, Excel, Images, ZIP — max 20 MB
                    </p>
                  </div>
                )}
              </div>

              {/* Fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label className="label">Document Type</label>
                  <input
                    className="input"
                    placeholder="e.g. Registration Certificate, Tax Return"
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Description (optional)</label>
                  <input
                    className="input"
                    placeholder="Brief description of this document"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 12,
                    padding: "10px 12px",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: 8,
                    color: "#ef4444",
                    fontSize: 13,
                  }}
                >
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button
                  className="btn-ghost"
                  onClick={onClose}
                  style={{ flex: 1 }}
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  className="btn-brand"
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  style={{ flex: 1 }}
                >
                  {uploading ? "Uploading…" : "Upload Document"}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
