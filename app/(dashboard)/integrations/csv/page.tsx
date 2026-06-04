"use client";

// ============================================================
// /integrations/csv — Premium CSV Import Center
// 5-step flow:
//   1. Choose Import Type (9 entity cards)
//   2. Download Template (CSV + guide)
//   3. Upload CSV (drag-drop + validation)
//   4. Preview Data (editable table preview)
//   5. Import (progress + results)
// ============================================================

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  Upload,
  FileSpreadsheet,
  Users,
  Building2,
  FileText,
  Package,
  Layers,
  Scale,
  UserCheck,
  BarChart3,
  RefreshCw,
  Info,
  ChevronRight,
  Eye,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { useImportProgress } from "@/hooks/useImportProgress";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WizardStep = "choose" | "template" | "upload" | "preview" | "importing" | "results";

interface EntityType {
  id: string;
  label: string;
  apiEntity: string;
  description: string;
  icon: React.FC<{ size?: number; color?: string }>;
  color: string;
  gradient: string;
  fields: string[];
  templateType: string;
}

interface UploadResult {
  importJobId: string;
  detectedColumns: string[];
  needsMapping: boolean;
}

interface PreviewRow {
  [key: string]: string;
}

interface ImportResultSummary {
  totalRows: number;
  successRows: number;
  failedRows: number;
  duplicateRows: number;
}

// ---------------------------------------------------------------------------
// Entity definitions
// ---------------------------------------------------------------------------

const ENTITY_TYPES: EntityType[] = [
  {
    id: "customers",
    label: "Customers",
    apiEntity: "CUSTOMERS",
    description: "Import customer profiles with GSTIN, PAN, contact details, and business info",
    icon: Users,
    color: "#3b82f6",
    gradient: "linear-gradient(135deg, #60a5fa, #3b82f6)",
    fields: ["customer_code", "name", "email", "phone", "gst_number", "pan_number", "city"],
    templateType: "CUSTOMER",
  },
  {
    id: "vendors",
    label: "Vendors",
    apiEntity: "VENDORS",
    description: "Bulk import suppliers and vendors with GST and bank details",
    icon: Building2,
    color: "#8b5cf6",
    gradient: "linear-gradient(135deg, #a78bfa, #8b5cf6)",
    fields: ["vendor_code", "vendor_name", "email", "phone", "gst_number", "status"],
    templateType: "VENDOR",
  },
  {
    id: "invoices",
    label: "Invoices",
    apiEntity: "INVOICES",
    description: "Import sales invoices with customer mapping, tax details, and due dates",
    icon: FileText,
    color: "#06b6d4",
    gradient: "linear-gradient(135deg, #22d3ee, #06b6d4)",
    fields: ["invoice_number", "customer_code", "invoice_date", "total_amount", "status"],
    templateType: "INVOICE",
  },
  {
    id: "bills",
    label: "Bills",
    apiEntity: "VENDORS",
    description: "Import purchase bills with vendor mapping and payment tracking",
    icon: FileText,
    color: "#f59e0b",
    gradient: "linear-gradient(135deg, #fbbf24, #f59e0b)",
    fields: ["bill_number", "vendor_code", "bill_date", "total_amount", "status"],
    templateType: "BILL",
  },
  {
    id: "products",
    label: "Products",
    apiEntity: "PRODUCTS",
    description: "Bulk add products with SKU, pricing, GST rates, and stock levels",
    icon: Package,
    color: "#10b981",
    gradient: "linear-gradient(135deg, #34d399, #10b981)",
    fields: ["sku", "product_name", "category", "price", "gst_rate", "stock_quantity"],
    templateType: "PRODUCT",
  },
  {
    id: "inventory",
    label: "Inventory",
    apiEntity: "PRODUCTS",
    description: "Update stock levels, warehouse allocations, and reorder points",
    icon: Layers,
    color: "#ec4899",
    gradient: "linear-gradient(135deg, #f472b6, #ec4899)",
    fields: ["sku", "warehouse", "current_stock", "minimum_stock", "reorder_level"],
    templateType: "INVENTORY",
  },
  {
    id: "compliance",
    label: "Compliance Cases",
    apiEntity: "CUSTOMERS",
    description: "Import compliance filings with deadlines, assigned CA, and priorities",
    icon: Scale,
    color: "#e05a00",
    gradient: "linear-gradient(135deg, #fb923c, #e05a00)",
    fields: ["case_id", "client_name", "compliance_type", "due_date", "assigned_ca"],
    templateType: "COMPLIANCE_CASE",
  },
  {
    id: "ca-clients",
    label: "CA Clients",
    apiEntity: "CUSTOMERS",
    description: "Import CA client profiles with GSTIN, PAN, and assigned CA details",
    icon: UserCheck,
    color: "#0f9d58",
    gradient: "linear-gradient(135deg, #34d399, #0f9d58)",
    fields: ["client_code", "client_name", "gstin", "pan", "assigned_ca"],
    templateType: "CA_CLIENT",
  },
  {
    id: "treds",
    label: "TReDS Transactions",
    apiEntity: "CUSTOMERS",
    description: "Import TReDS trade receivable transactions and financing details",
    icon: BarChart3,
    color: "#6c4dd6",
    gradient: "linear-gradient(135deg, #8b6cf7, #6c4dd6)",
    fields: ["transaction_id", "buyer_name", "invoice_amount", "discount_rate", "financier"],
    templateType: "TREDS",
  },
];

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEP_CONFIG = [
  { id: "choose", label: "Choose Type" },
  { id: "template", label: "Download" },
  { id: "upload", label: "Upload" },
  { id: "preview", label: "Preview" },
  { id: "importing", label: "Import" },
  { id: "results", label: "Complete" },
];

function StepBar({ current }: { current: WizardStep }) {
  const currentIdx = STEP_CONFIG.findIndex((s) => s.id === current);
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        height: 3, background: "var(--bg-elevated)",
        borderRadius: 3, marginBottom: 16, overflow: "hidden",
      }}>
        <motion.div
          animate={{ width: `${(currentIdx / (STEP_CONFIG.length - 1)) * 100}%` }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          style={{
            height: "100%",
            background: "linear-gradient(90deg, #3b82f6, #06b6d4)",
            borderRadius: 3,
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {STEP_CONFIG.map((s, i) => {
          const isDone = i < currentIdx;
          const isActive = i === currentIdx;
          return (
            <div key={s.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.3s",
                background: isDone
                  ? "linear-gradient(135deg, #3b82f6, #06b6d4)"
                  : isActive ? "#3b82f615" : "var(--bg-elevated)",
                border: isActive ? "2px solid #3b82f6" : isDone ? "none" : "2px solid var(--border)",
                boxShadow: isActive ? "0 0 0 3px #3b82f615" : "none",
              }}>
                {isDone ? (
                  <CheckCircle2 size={13} color="white" />
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? "#3b82f6" : "var(--text-muted)" }}>
                    {i + 1}
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 9, fontWeight: 600,
                color: isActive ? "#3b82f6" : isDone ? "var(--text-secondary)" : "var(--text-muted)",
                whiteSpace: "nowrap",
              }}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CsvImportCenter() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("choose");
  const [selectedEntity, setSelectedEntity] = useState<EntityType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResultSummary | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SSE progress
  const { progress } = useImportProgress(
    step === "importing" ? (uploadResult?.importJobId ?? null) : null,
    {
      onComplete: (p) => {
        setImportResult({
          totalRows: p.totalRows,
          successRows: p.successRows,
          failedRows: p.failedRows,
          duplicateRows: p.duplicateRows,
        });
        setStep("results");
      },
    }
  );

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }

  // File acceptance
  const acceptFile = useCallback((f: File) => {
    const ext = "." + (f.name.split(".").pop() ?? "").toLowerCase();
    if (![".csv", ".xlsx", ".xls"].includes(ext)) {
      setUploadError(`Unsupported file type "${ext}". Use .csv, .xlsx, or .xls`);
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setUploadError("File exceeds 50 MB limit.");
      return;
    }
    setFile(f);
    setUploadError(null);
  }, []);

  // Drag handlers
  function handleDragEnter(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) acceptFile(dropped);
  }

  // Template download
  async function downloadTemplate() {
    if (!selectedEntity) return;
    setDownloadingTemplate(true);
    try {
      const a = document.createElement("a");
      a.href = `/api/templates?type=${selectedEntity.templateType}`;
      a.click();
      toast.success(`${selectedEntity.label} template downloaded`);
    } finally {
      setTimeout(() => setDownloadingTemplate(false), 1500);
    }
  }

  // Upload handler
  async function handleUpload() {
    if (!file || !selectedEntity) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entity", selectedEntity.apiEntity);

      const res = await fetch("/api/imports", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Upload failed");
      }

      const data = await res.json() as UploadResult;
      setUploadResult(data);

      // Build preview rows from detected columns
      if (data.detectedColumns.length > 0) {
        const sampleRow: PreviewRow = {};
        data.detectedColumns.forEach((col) => { sampleRow[col] = ""; });
        setPreviewRows([sampleRow]);
      }

      setStep("preview");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  // Start import (go to mapping wizard)
  function goToImportWizard() {
    if (!uploadResult || !selectedEntity) return;
    router.push(`/imports/${uploadResult.importJobId}?entity=${selectedEntity.apiEntity}`);
  }

  // Start direct import (skip mapping)
  async function handleStartImport() {
    if (!uploadResult) return;
    try {
      await fetch(`/api/imports/${uploadResult.importJobId}/mapping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useAutoMapping: true }),
      });
      setStep("importing");
    } catch {
      setStep("importing");
    }
  }

  const slideVariants = {
    initial: { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -24 },
  };

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "28px 24px" }}>

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
        <Link href="/integrations" style={{ textDecoration: "none", display: "inline-block", marginBottom: 16 }}>
          <button style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 8,
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            fontSize: 13, color: "var(--text-secondary)", cursor: "pointer",
          }}>
            <ArrowLeft size={13} />
            Back to Integrations
          </button>
        </Link>

        <div style={{
          background: "linear-gradient(135deg, #3b82f610, #06b6d408)",
          border: "1px solid #3b82f620",
          borderRadius: 18, padding: "22px 28px",
          display: "flex", alignItems: "center", gap: 16,
          flexWrap: "wrap",
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px #3b82f640",
            flexShrink: 0,
          }}>
            <FileSpreadsheet size={24} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>
              CSV Import Center
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
              Download templates, upload your data, validate, preview, and sync in minutes.
            </p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { label: "9 Entity Types", color: "#3b82f6" },
              { label: "Auto-Validation", color: "#10b981" },
              { label: "Preview Before Import", color: "#8b5cf6" },
            ].map(({ label, color }) => (
              <span key={label} style={{
                fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20,
                background: `${color}12`, border: `1px solid ${color}25`, color,
              }}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Wizard card ── */}
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: 20, padding: "28px 32px",
      }}>
        <StepBar current={step} />

        <AnimatePresence mode="wait">

          {/* ════════════════════════════════
              STEP 1: Choose Import Type
          ════════════════════════════════ */}
          {step === "choose" && (
            <motion.div key="choose" variants={slideVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 5 }}>
                  What would you like to import?
                </h2>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Select a data type to get started. Each type has a pre-built template and validation rules.
                </p>
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 12,
              }}>
                {ENTITY_TYPES.map((entity, i) => {
                  const Icon = entity.icon;
                  const isSelected = selectedEntity?.id === entity.id;
                  return (
                    <motion.button
                      key={entity.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => setSelectedEntity(entity)}
                      style={{
                        padding: "16px 18px",
                        borderRadius: 14,
                        border: isSelected ? `2px solid ${entity.color}60` : "2px solid var(--border)",
                        background: isSelected
                          ? `linear-gradient(135deg, ${entity.color}12, ${entity.color}06)`
                          : "var(--bg-elevated)",
                        cursor: "pointer", textAlign: "left",
                        transition: "all 0.2s",
                        boxShadow: isSelected ? `0 4px 16px ${entity.color}25` : "none",
                        transform: isSelected ? "scale(1.02)" : "scale(1)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 9,
                          background: isSelected ? entity.gradient : `${entity.color}15`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                          boxShadow: isSelected ? `0 3px 8px ${entity.color}40` : "none",
                          transition: "all 0.2s",
                        }}>
                          <Icon size={16} color={isSelected ? "white" : entity.color} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: isSelected ? entity.color : "var(--text-primary)" }}>
                            {entity.label}
                          </p>
                        </div>
                        {isSelected && <CheckCircle2 size={14} color={entity.color} />}
                      </div>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 10 }}>
                        {entity.description}
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {entity.fields.slice(0, 3).map((f) => (
                          <span key={f} style={{
                            fontSize: 9, fontFamily: "monospace",
                            padding: "2px 6px", borderRadius: 4,
                            background: isSelected ? `${entity.color}15` : "var(--bg-surface)",
                            color: isSelected ? entity.color : "var(--text-muted)",
                            border: `1px solid ${isSelected ? entity.color + "25" : "var(--border)"}`,
                          }}>
                            {f}
                          </span>
                        ))}
                        {entity.fields.length > 3 && (
                          <span style={{ fontSize: 9, color: "var(--text-muted)" }}>
                            +{entity.fields.length - 3}
                          </span>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setStep("template")}
                  disabled={!selectedEntity}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "11px 24px", borderRadius: 10,
                    background: selectedEntity
                      ? `linear-gradient(135deg, ${selectedEntity.color}, ${selectedEntity.color}cc)`
                      : "var(--bg-elevated)",
                    color: selectedEntity ? "white" : "var(--text-muted)",
                    border: "none", fontSize: 14, fontWeight: 700,
                    cursor: selectedEntity ? "pointer" : "not-allowed",
                    boxShadow: selectedEntity ? `0 4px 14px ${selectedEntity.color}40` : "none",
                    transition: "all 0.2s",
                  }}
                >
                  Continue with {selectedEntity?.label ?? "selection"}
                  <ArrowRight size={15} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════
              STEP 2: Download Template
          ════════════════════════════════ */}
          {step === "template" && selectedEntity && (
            <motion.div key="template" variants={slideVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: selectedEntity.gradient,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {(() => { const Icon = selectedEntity.icon; return <Icon size={15} color="white" />; })()}
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                    Download {selectedEntity.label} Template
                  </h2>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Download the CSV template, fill it with your data, then upload it in the next step.
                </p>
              </div>

              {/* Template card */}
              <div style={{
                background: `linear-gradient(135deg, ${selectedEntity.color}10, ${selectedEntity.color}05)`,
                border: `1px solid ${selectedEntity.color}30`,
                borderRadius: 16, padding: "24px",
                marginBottom: 16,
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                      {selectedEntity.label} CSV Template
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.6 }}>
                      Pre-filled with 3 sample rows showing the exact format required.
                      All required fields are marked. Remove sample rows before importing.
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                      {selectedEntity.fields.map((f) => (
                        <span key={f} style={{
                          fontSize: 10, fontFamily: "monospace",
                          padding: "2px 8px", borderRadius: 5,
                          background: "var(--bg-surface)",
                          color: "var(--text-secondary)",
                          border: "1px solid var(--border)",
                        }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={downloadTemplate}
                    disabled={downloadingTemplate}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "12px 22px", borderRadius: 10,
                      background: downloadingTemplate ? "var(--bg-elevated)" : selectedEntity.gradient,
                      color: downloadingTemplate ? "var(--text-muted)" : "white",
                      border: "none", fontSize: 13, fontWeight: 700,
                      cursor: downloadingTemplate ? "not-allowed" : "pointer",
                      flexShrink: 0,
                      boxShadow: downloadingTemplate ? "none" : `0 4px 12px ${selectedEntity.color}40`,
                      transition: "all 0.2s",
                    }}
                  >
                    {downloadingTemplate ? (
                      <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Downloading…</>
                    ) : (
                      <><Download size={13} /> Download CSV</>
                    )}
                  </button>
                </div>
              </div>

              {/* Guide download */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px",
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                borderRadius: 12, marginBottom: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <BookOpen size={15} color="var(--text-muted)" />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      Import Guide (PDF)
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Validation rules, column specs, and common errors
                    </p>
                  </div>
                </div>
                <a
                  href={`/api/templates/guide?type=${selectedEntity.templateType}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "none" }}
                >
                  <button style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "7px 14px", borderRadius: 8,
                    background: "var(--bg-surface)", border: "1px solid var(--border)",
                    fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer",
                  }}>
                    <Download size={12} />
                    Open Guide
                  </button>
                </a>
              </div>

              {/* Tips */}
              <div style={{
                padding: "14px 16px",
                background: "#3b82f608",
                border: "1px solid #3b82f620",
                borderRadius: 12, marginBottom: 24,
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <Info size={14} color="#3b82f6" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#3b82f6", marginBottom: 6 }}>
                      How to fill the template
                    </p>
                    <ul style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7, paddingLeft: 14 }}>
                      <li>Keep the header row exactly as-is (column names must not change)</li>
                      <li>Delete the sample data rows and replace with your own data</li>
                      <li>GST numbers must be 15 characters in format: 22AAAAA0000A1Z5</li>
                      <li>Dates must be in DD/MM/YYYY or YYYY-MM-DD format</li>
                      <li>Save as CSV (.csv) or keep as .xlsx — both are accepted</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button
                  onClick={() => setStep("choose")}
                  style={{
                    padding: "10px 18px", borderRadius: 10,
                    background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    fontSize: 13, color: "var(--text-secondary)", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <ArrowLeft size={13} />
                  Back
                </button>
                <button
                  onClick={() => setStep("upload")}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "11px 24px", borderRadius: 10,
                    background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
                    color: "white", border: "none",
                    fontSize: 14, fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 4px 14px #3b82f640",
                  }}
                >
                  I have my file ready
                  <ArrowRight size={15} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════
              STEP 3: Upload CSV
          ════════════════════════════════ */}
          {step === "upload" && selectedEntity && (
            <motion.div key="upload" variants={slideVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 5 }}>
                  Upload your {selectedEntity.label} file
                </h2>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Drop your CSV or Excel file below. We'll automatically detect your columns.
                </p>
              </div>

              {/* Drop zone */}
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? "#3b82f6" : file ? "#10b981" : "var(--border)"}`,
                  borderRadius: 16, padding: "40px 32px",
                  textAlign: "center", cursor: "pointer",
                  background: isDragging ? "#3b82f608" : file ? "#10b98108" : "var(--bg-elevated)",
                  transition: "all 0.2s",
                  marginBottom: 16,
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) acceptFile(f); e.target.value = ""; }}
                />
                <AnimatePresence mode="wait">
                  {file ? (
                    <motion.div key="file" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                      <div style={{
                        width: 56, height: 56, borderRadius: 14,
                        background: "linear-gradient(135deg, #34d399, #10b981)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        margin: "0 auto 14px", boxShadow: "0 4px 16px #10b98140",
                      }}>
                        <FileSpreadsheet size={24} color="white" />
                      </div>
                      <p style={{ fontSize: 16, fontWeight: 700, color: "#10b981", marginBottom: 4 }}>
                        {file.name}
                      </p>
                      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {formatBytes(file.size)} · Click or drag to replace
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <div style={{
                        width: 56, height: 56, borderRadius: 14,
                        background: "var(--bg-surface)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        margin: "0 auto 14px",
                      }}>
                        <Upload size={24} color="var(--text-muted)" />
                      </div>
                      <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                        Drop your file here
                      </p>
                      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
                        or click to browse files
                      </p>
                      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        {[".csv", ".xlsx", ".xls"].map((ext) => (
                          <span key={ext} style={{
                            fontSize: 11, padding: "3px 9px", borderRadius: 6,
                            background: "var(--bg-surface)", border: "1px solid var(--border)",
                            color: "var(--text-muted)", fontWeight: 600,
                          }}>
                            {ext}
                          </span>
                        ))}
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>· Max 50 MB</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {uploadError && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 14px", borderRadius: 10,
                  background: "#ef444412", border: "1px solid #ef444425",
                  marginBottom: 16,
                }}>
                  <AlertCircle size={14} color="#ef4444" />
                  <p style={{ fontSize: 13, color: "#ef4444" }}>{uploadError}</p>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <button
                  onClick={() => setStep("template")}
                  style={{
                    padding: "10px 18px", borderRadius: 10,
                    background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    fontSize: 13, color: "var(--text-secondary)", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <ArrowLeft size={13} />
                  Back
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!file || isUploading}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "11px 24px", borderRadius: 10,
                    background: !file || isUploading ? "var(--bg-elevated)" : "linear-gradient(135deg, #3b82f6, #06b6d4)",
                    color: !file || isUploading ? "var(--text-muted)" : "white",
                    border: "none", fontSize: 14, fontWeight: 700,
                    cursor: !file || isUploading ? "not-allowed" : "pointer",
                    boxShadow: file && !isUploading ? "0 4px 14px #3b82f640" : "none",
                  }}
                >
                  {isUploading ? (
                    <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Uploading…</>
                  ) : (
                    <><Eye size={14} /> Upload & Preview</>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════
              STEP 4: Preview Data
          ════════════════════════════════ */}
          {step === "preview" && uploadResult && selectedEntity && (
            <motion.div key="preview" variants={slideVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 5 }}>
                  Preview Detected Data
                </h2>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  We found {uploadResult.detectedColumns.length} columns. Review them before importing.
                </p>
              </div>

              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "Columns Detected", value: uploadResult.detectedColumns.length, color: "#3b82f6" },
                  { label: "Mapping Required", value: uploadResult.needsMapping ? "Yes" : "Auto", color: uploadResult.needsMapping ? "#f59e0b" : "#10b981" },
                  { label: "Entity Type", value: selectedEntity.label, color: selectedEntity.color },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    padding: "14px 16px",
                    background: `${color}10`,
                    border: `1px solid ${color}25`,
                    borderRadius: 12, textAlign: "center",
                  }}>
                    <p style={{ fontSize: 20, fontWeight: 800, color, marginBottom: 3 }}>
                      {value}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Detected columns */}
              <div style={{
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "16px 18px", marginBottom: 20,
              }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Detected Columns ({uploadResult.detectedColumns.length})
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {uploadResult.detectedColumns.map((col) => (
                    <span key={col} style={{
                      fontSize: 11, fontFamily: "monospace",
                      padding: "4px 10px", borderRadius: 6,
                      background: "var(--bg-surface)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border)",
                      fontWeight: 500,
                    }}>
                      {col}
                    </span>
                  ))}
                </div>
              </div>

              {/* Info banner */}
              {uploadResult.needsMapping && (
                <div style={{
                  padding: "12px 16px",
                  background: "#f59e0b10",
                  border: "1px solid #f59e0b25",
                  borderRadius: 12, marginBottom: 20,
                  display: "flex", alignItems: "flex-start", gap: 10,
                }}>
                  <AlertCircle size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 12, color: "#f59e0b", lineHeight: 1.6 }}>
                    <strong>Column mapping required.</strong> Some columns don't automatically match FinRP fields.
                    Click "Map & Import" to manually map your columns, or "Auto Import" to let FinRP guess the mappings.
                  </p>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
                <button
                  onClick={() => setStep("upload")}
                  style={{
                    padding: "10px 18px", borderRadius: 10,
                    background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    fontSize: 13, color: "var(--text-secondary)", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <ArrowLeft size={13} />
                  Change File
                </button>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={goToImportWizard}
                    style={{
                      padding: "10px 18px", borderRadius: 10,
                      background: "var(--bg-elevated)", border: "1px solid var(--border)",
                      fontSize: 13, color: "var(--text-secondary)", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <Settings2 size={13} />
                    Map Columns
                  </button>
                  <button
                    onClick={handleStartImport}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "11px 24px", borderRadius: 10,
                      background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
                      color: "white", border: "none",
                      fontSize: 14, fontWeight: 700, cursor: "pointer",
                      boxShadow: "0 4px 14px #3b82f640",
                    }}
                  >
                    <Sparkles size={14} />
                    Start Import
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════
              STEP 5: Importing
          ════════════════════════════════ */}
          {step === "importing" && (
            <motion.div key="importing" variants={slideVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 5 }}>
                  Importing your data…
                </h2>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Processing your file. Large imports may take a few minutes.
                </p>
              </div>

              {/* Progress bar */}
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  height: 12, background: "var(--bg-elevated)",
                  borderRadius: 6, overflow: "hidden", marginBottom: 6,
                }}>
                  <motion.div
                    animate={{ width: `${progress?.progress ?? 5}%` }}
                    transition={{ duration: 0.6 }}
                    style={{
                      height: "100%",
                      background: "linear-gradient(90deg, #3b82f6, #06b6d4)",
                      borderRadius: 6,
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)" }}>
                  <span>{progress?.progress ?? 0}% complete</span>
                  {progress && (
                    <span>
                      {(progress.processedRows ?? 0).toLocaleString()} / {(progress.totalRows ?? 0).toLocaleString()} rows
                    </span>
                  )}
                </div>
              </div>

              {/* Live stats */}
              {progress && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 20 }}>
                  {[
                    { label: "Imported", value: progress.successRows ?? 0, color: "#10b981" },
                    { label: "Failed", value: progress.failedRows ?? 0, color: "#ef4444" },
                    { label: "Duplicates", value: progress.duplicateRows ?? 0, color: "#f59e0b" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{
                      padding: "16px", borderRadius: 12, textAlign: "center",
                      background: `${color}10`, border: `1px solid ${color}25`,
                    }}>
                      <motion.p
                        key={value}
                        initial={{ scale: 1.1 }}
                        animate={{ scale: 1 }}
                        style={{ fontSize: 24, fontWeight: 800, color, marginBottom: 4 }}
                      >
                        {value.toLocaleString()}
                      </motion.p>
                      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</p>
                    </div>
                  ))}
                </div>
              )}

              <div style={{
                marginTop: 24, display: "flex", alignItems: "center", gap: 10,
                padding: "12px 16px", borderRadius: 10,
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
              }}>
                <RefreshCw size={14} color="#3b82f6" style={{ animation: "spin 1s linear infinite" }} />
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {progress ? `${progress.processedRows.toLocaleString()} of ${progress.totalRows.toLocaleString()} rows processed` : "Processing rows in background…"}
                </p>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════
              STEP 6: Results
          ════════════════════════════════ */}
          {step === "results" && importResult && (
            <motion.div key="results" variants={slideVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22 }}>
              <div style={{ textAlign: "center", paddingTop: 12 }}>
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 18 }}
                  style={{
                    width: 72, height: 72, borderRadius: 20,
                    background: importResult.failedRows === 0
                      ? "linear-gradient(135deg, #10b981, #059669)"
                      : importResult.successRows === 0
                      ? "linear-gradient(135deg, #ef4444, #dc2626)"
                      : "linear-gradient(135deg, #f59e0b, #d97706)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 18px",
                    boxShadow: importResult.failedRows === 0
                      ? "0 8px 28px #10b98140"
                      : importResult.successRows === 0
                      ? "0 8px 28px #ef444440"
                      : "0 8px 28px #f59e0b40",
                  }}
                >
                  {importResult.failedRows === 0 ? (
                    <CheckCircle2 size={36} color="white" />
                  ) : importResult.successRows === 0 ? (
                    <XCircle size={36} color="white" />
                  ) : (
                    <AlertCircle size={36} color="white" />
                  )}
                </motion.div>

                <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>
                  {importResult.failedRows === 0
                    ? "Import Complete!"
                    : importResult.successRows === 0
                    ? "Import Failed"
                    : "Import Partially Complete"}
                </h2>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
                  {importResult.failedRows === 0
                    ? `All ${importResult.successRows.toLocaleString()} records were imported successfully.`
                    : `${importResult.successRows.toLocaleString()} imported, ${importResult.failedRows.toLocaleString()} failed.`}
                </p>

                {/* Stats grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 24 }}>
                  {[
                    { label: "Total Rows", value: importResult.totalRows, color: "#6b7280" },
                    { label: "Imported", value: importResult.successRows, color: "#10b981" },
                    { label: "Failed", value: importResult.failedRows, color: "#ef4444" },
                    { label: "Duplicates", value: importResult.duplicateRows, color: "#f59e0b" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{
                      padding: "16px", borderRadius: 12,
                      background: `${color}10`, border: `1px solid ${color}25`,
                    }}>
                      <p style={{ fontSize: 26, fontWeight: 800, color, marginBottom: 4 }}>
                        {value.toLocaleString()}
                      </p>
                      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</p>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  {importResult.failedRows > 0 && uploadResult && (
                    <a href={`/api/imports/${uploadResult.importJobId}/download-errors`} style={{ textDecoration: "none" }}>
                      <button style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        padding: "11px 20px", borderRadius: 10,
                        background: "var(--bg-elevated)", border: "1px solid var(--border)",
                        fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer",
                      }}>
                        <Download size={13} />
                        Download Error Report
                      </button>
                    </a>
                  )}
                  <button
                    onClick={() => { setStep("choose"); setSelectedEntity(null); setFile(null); setUploadResult(null); setImportResult(null); }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "11px 20px", borderRadius: 10,
                      background: "var(--bg-elevated)", border: "1px solid var(--border)",
                      fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer",
                    }}
                  >
                    <RefreshCw size={13} />
                    Import More
                  </button>
                  <Link href="/imports" style={{ textDecoration: "none" }}>
                    <button style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "11px 20px", borderRadius: 10,
                      background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
                      color: "white", border: "none",
                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                      boxShadow: "0 4px 12px #3b82f640",
                    }}>
                      <BarChart3 size={13} />
                      View Import History
                    </button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 600px) {
          div[style*="gridTemplateColumns: repeat(auto-fill, minmax(240px"] {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 420px) {
          div[style*="gridTemplateColumns: repeat(auto-fill, minmax(240px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

// Re-import for missing icon
function Settings2(props: { size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg width={props.size ?? 16} height={props.size ?? 16} viewBox="0 0 24 24" fill="none" stroke={props.color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={props.style}>
      <path d="M20 7H4" /><path d="M20 12H4" /><path d="M20 17H4" />
      <circle cx="8" cy="7" r="2" fill={props.color ?? "currentColor"} stroke="none" />
      <circle cx="16" cy="12" r="2" fill={props.color ?? "currentColor"} stroke="none" />
      <circle cx="8" cy="17" r="2" fill={props.color ?? "currentColor"} stroke="none" />
    </svg>
  );
}
