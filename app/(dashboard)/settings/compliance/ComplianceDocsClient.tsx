"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileCheck,
  Upload,
  Trash2,
  Eye,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  X,
  FileText,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

interface OrgDocument {
  id: string;
  documentType: string;
  displayName: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  uploadedAt: string;
  expiryDate: string | null;
  status: string;
  isVerified: boolean;
  notes: string | null;
}

interface DocumentSlot {
  documentType: string;
  displayName: string;
  required: boolean;
  document: OrgDocument | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<{size: number}> }> = {
  UPLOADED: { label: "Uploaded", color: "#3b82f6", bg: "#3b82f615", icon: FileText },
  PENDING_VERIFICATION: { label: "Pending Review", color: "#f59e0b", bg: "#f59e0b15", icon: Clock },
  VERIFIED: { label: "Verified", color: "#10b981", bg: "#10b98115", icon: CheckCircle },
  REJECTED: { label: "Rejected", color: "#ef4444", bg: "#ef444415", icon: AlertCircle },
  EXPIRED: { label: "Expired", color: "#f59e0b", bg: "#f59e0b15", icon: AlertCircle },
  MISSING: { label: "Missing", color: "#6b7280", bg: "#6b728015", icon: AlertCircle },
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ComplianceDocsClient({ initialDocuments }: { initialDocuments: DocumentSlot[] }) {
  const [documents, setDocuments] = useState<DocumentSlot[]>(initialDocuments);
  const [uploading, setUploading] = useState<string | null>(null);
  const [preview, setPreview] = useState<OrgDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadType, setActiveUploadType] = useState<string | null>(null);

  async function fetchDocuments() {
    try {
      const res = await fetch("/api/settings/documents");
      const data = await res.json();
      setDocuments(data.documents);
    } catch {
      toast.error("Failed to refresh documents");
    }
  }

  function handleUploadClick(docType: string) {
    setActiveUploadType(docType);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeUploadType) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10 MB");
      return;
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PDF, JPG, PNG files are allowed");
      return;
    }

    try {
      setUploading(activeUploadType);
      // Convert file to base64 for storage
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const slot = documents.find((d) => d.documentType === activeUploadType);
      const res = await fetch("/api/settings/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: activeUploadType,
          displayName: slot?.displayName || file.name,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          fileUrl: base64,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      toast.success(`${slot?.displayName || "Document"} uploaded successfully`);
      fetchDocuments();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
      setActiveUploadType(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(docId: string, displayName: string) {
    if (!confirm(`Delete ${displayName}? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/settings/documents?id=${docId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Document deleted");
      fetchDocuments();
    } catch {
      toast.error("Failed to delete document");
    }
  }

  const uploaded = documents.filter((d) => d.document);
  const missing = documents.filter((d) => !d.document);
  const verified = documents.filter((d) => d.document?.status === "VERIFIED");


  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          Compliance Document Center
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Manage and verify your organization's official documents
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {[
          {
            label: "Documents Uploaded",
            value: uploaded.length,
            total: documents.length,
            color: "#3b82f6",
            icon: <FileText size={18} />,
          },
          {
            label: "Verified",
            value: verified.length,
            total: documents.length,
            color: "#10b981",
            icon: <CheckCircle size={18} />,
          },
          {
            label: "Missing",
            value: missing.length,
            total: documents.length,
            color: "#ef4444",
            icon: <AlertCircle size={18} />,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: `${stat.color}15`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: stat.color,
              }}
            >
              {stat.icon}
            </div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
                {stat.value}
                <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 400 }}>
                  /{stat.total}
                </span>
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{stat.label}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Document Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {documents.map((slot, idx) => {
          const doc = slot.document;
          const statusKey = doc?.status ?? "MISSING";
          const status = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.MISSING;
          const StatusIcon = status.icon;
          const isExpired = doc?.expiryDate && new Date(doc.expiryDate) < new Date();
          const isUploading = uploading === slot.documentType;

          return (
            <motion.div
              key={slot.documentType}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              style={{
                background: "var(--bg-surface)",
                border: `1px solid ${doc ? "var(--border)" : "#ef444425"}`,
                borderRadius: 14,
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                    {slot.displayName}
                  </p>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 20,
                      background: isExpired ? "#ef444415" : status.bg,
                      color: isExpired ? "#ef4444" : status.color,
                    }}
                  >
                    <StatusIcon size={10} />
                    {isExpired ? "Expired" : status.label}
                  </span>
                </div>
                {slot.required && !doc && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: "#ef444420",
                      color: "#ef4444",
                    }}
                  >
                    Required
                  </span>
                )}
              </div>

              {/* Document Info */}
              {doc ? (
                <div
                  style={{
                    background: "var(--bg-elevated)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <FileText size={16} color="var(--text-muted)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {doc.fileName}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {formatBytes(doc.fileSize)} ·{" "}
                      {new Date(doc.uploadedAt).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    background: "var(--bg-elevated)",
                    borderRadius: 8,
                    padding: "16px",
                    textAlign: "center",
                    border: "2px dashed var(--border)",
                  }}
                >
                  <Upload size={20} color="var(--text-muted)" style={{ margin: "0 auto 6px" }} />
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No document uploaded</p>
                </div>
              )}

              {/* Expiry */}
              {doc?.expiryDate && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    color: isExpired ? "#ef4444" : "var(--text-muted)",
                  }}
                >
                  <Clock size={12} />
                  {isExpired ? "Expired" : "Expires"}{" "}
                  {new Date(doc.expiryDate).toLocaleDateString("en-IN")}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                {doc && (
                  <>
                    <button
                      onClick={() => setPreview(doc)}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        padding: "7px",
                        background: "var(--bg-elevated)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border)",
                        borderRadius: 7,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      <Eye size={12} />
                      View
                    </button>
                    <button
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = doc.fileUrl;
                        a.download = doc.fileName;
                        a.click();
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "7px 10px",
                        background: "var(--bg-elevated)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border)",
                        borderRadius: 7,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      <Download size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id, slot.displayName)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "7px 10px",
                        background: "#ef444415",
                        color: "#ef4444",
                        border: "1px solid #ef444430",
                        borderRadius: 7,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleUploadClick(slot.documentType)}
                  disabled={isUploading}
                  style={{
                    flex: doc ? 0 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "7px 12px",
                    background: isUploading ? "var(--bg-elevated)" : "#6366f1",
                    color: isUploading ? "var(--text-muted)" : "white",
                    border: "none",
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: isUploading ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {isUploading ? (
                    "Uploading…"
                  ) : doc ? (
                    <><Plus size={11} /> Replace</>
                  ) : (
                    <><Upload size={11} /> Upload</>
                  )}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 200,
              padding: 24,
            }}
            onClick={() => setPreview(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                width: "100%",
                maxWidth: 720,
                maxHeight: "80vh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                    {preview.displayName || preview.fileName}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {formatBytes(preview.fileSize)} · Uploaded{" "}
                    {new Date(preview.uploadedAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <button
                  onClick={() => setPreview(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                >
                  <X size={20} />
                </button>
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: 0, background: "#000" }}>
                {preview.mimeType.startsWith("image/") ? (
                  <img
                    src={preview.fileUrl}
                    alt={preview.fileName}
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                ) : preview.mimeType === "application/pdf" ? (
                  <iframe
                    src={preview.fileUrl}
                    style={{ width: "100%", height: 500, border: "none" }}
                    title={preview.fileName}
                  />
                ) : (
                  <div style={{ padding: 40, textAlign: "center", color: "white" }}>
                    <FileText size={48} style={{ margin: "0 auto 16px", opacity: 0.5 }} />
                    <p>Preview not available for this file type</p>
                    <button
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = preview.fileUrl;
                        a.download = preview.fileName;
                        a.click();
                      }}
                      style={{
                        marginTop: 16,
                        padding: "8px 18px",
                        background: "#6366f1",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                    >
                      Download File
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ height: 80, background: "var(--bg-elevated)", borderRadius: 12, animation: "pulse 2s infinite" }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{ height: 200, background: "var(--bg-elevated)", borderRadius: 14, animation: "pulse 2s infinite" }} />
        ))}
      </div>
    </div>
  );
}
