"use client";

// ============================================================
// Settings → Import Center
// Enterprise-grade CSV/Excel import hub for CA Firms.
// Sections: Stats, Template Downloads, Upload CTA, Recent History
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Download,
  FileSpreadsheet,
  Users,
  Building2,
  Link2,
  Layers,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  History,
  Sparkles,
  Info,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportJob {
  id: string;
  type: string;
  entity: string;
  status: string;
  originalName: string;
  fileSize: number;
  totalRows: number;
  successRows: number;
  failedRows: number;
  createdAt: string;
  completedAt: string | null;
  startedAt: string | null;
}

interface Stats {
  total: number;
  completed: number;
  failed: number;
  totalRecords: number;
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

interface TemplateCard {
  type: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; color?: string; className?: string }>;
  color: string;
  bg: string;
  fields: string[];
}

const TEMPLATES: TemplateCard[] = [
  {
    type: "CUSTOMER",
    title: "Customer Template",
    description: "Bulk import customers with contact details, GSTIN, and business info",
    icon: Users,
    color: "#3b82f6",
    bg: "#3b82f615",
    fields: ["customer_code", "customer_name", "email", "phone", "gst_number", "pan_number", "city"],
  },
  {
    type: "VENDOR",
    title: "Vendor Template",
    description: "Import suppliers and vendors with GST numbers and bank details",
    icon: Building2,
    color: "#8b5cf6",
    bg: "#8b5cf615",
    fields: ["vendor_code", "vendor_name", "email", "phone", "gst_number", "status"],
  },
  {
    type: "INVOICE",
    title: "Invoice Template",
    description: "Import sales invoices with customer mapping and tax details",
    icon: FileSpreadsheet,
    color: "#06b6d4",
    bg: "#06b6d415",
    fields: ["invoice_number", "customer_code", "invoice_date", "total_amount", "status"],
  },
  {
    type: "PRODUCT",
    title: "Product Template",
    description: "Bulk import products with SKU, pricing, GST rates, and stock",
    icon: Layers,
    color: "#10b981",
    bg: "#10b98115",
    fields: ["sku", "product_name", "category", "price", "gst_rate", "stock_quantity"],
  },
  {
    type: "CA_USER",
    title: "CA User Template",
    description: "Onboard CA staff members — sends invite emails automatically",
    icon: FileSpreadsheet,
    color: "#f59e0b",
    bg: "#f59e0b15",
    fields: ["name", "email", "phone", "designation", "icai_number", "specialization"],
  },
  {
    type: "CA_CLIENT",
    title: "CA Client Template",
    description: "Import CA client profiles with GSTIN, PAN, and assigned CA",
    icon: Users,
    color: "#0f9d58",
    bg: "#0f9d5815",
    fields: ["client_code", "client_name", "gstin", "pan", "assigned_ca"],
  },
  {
    type: "TREDS",
    title: "TReDS Template",
    description: "Import TReDS trade receivable transactions and financing data",
    icon: Layers,
    color: "#6c4dd6",
    bg: "#6c4dd615",
    fields: ["transaction_id", "buyer_name", "invoice_amount", "discount_rate", "financier"],
  },
  {
    type: "COMPLIANCE_CASE",
    title: "Compliance Cases",
    description: "Import compliance filings with deadlines, assigned CA, and priorities",
    icon: FileSpreadsheet,
    color: "#e05a00",
    bg: "#e05a0015",
    fields: ["case_id", "client_name", "compliance_type", "due_date", "assigned_ca"],
  },
  {
    type: "ASSIGNMENT",
    title: "Assignment Template",
    description: "Map existing customers to CA staff for service management",
    icon: Link2,
    color: "#ec4899",
    bg: "#ec489915",
    fields: ["customer_email", "ca_email", "service_type", "start_date", "notes"],
  },
];

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function statusMeta(status: string) {
  const map: Record<string, { label: string; color: string; icon: React.ComponentType<{ size?: number }> }> = {
    COMPLETED: { label: "Completed", color: "#10b981", icon: CheckCircle2 },
    PARTIAL: { label: "Partial", color: "#f59e0b", icon: AlertCircle },
    FAILED: { label: "Failed", color: "#ef4444", icon: XCircle },
    PROCESSING: { label: "Processing", color: "#3b82f6", icon: RefreshCw },
    VALIDATING: { label: "Validating", color: "#6366f1", icon: RefreshCw },
    PENDING: { label: "Pending", color: "#6b7280", icon: Clock },
    MAPPING: { label: "Awaiting Mapping", color: "#8b5cf6", icon: Clock },
    CANCELLED: { label: "Cancelled", color: "#6b7280", icon: XCircle },
  };
  return map[status] ?? map.PENDING;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function entityLabel(entity: string) {
  const map: Record<string, string> = {
    CUSTOMERS: "Customers",
    CA_USERS: "CA Users",
    FIRMS: "Firms",
    ASSIGNMENTS: "Assignments",
    MASTER_IMPORT: "Master Import",
    VENDORS: "Vendors",
    INVOICES: "Invoices",
    PRODUCTS: "Products",
    EMPLOYEES: "Employees",
  };
  return map[entity] ?? entity;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ImportCenterPage() {
  const router = useRouter();
  const [imports, setImports] = useState<ImportJob[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, completed: 0, failed: 0, totalRecords: 0 });
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Fetch recent imports
  useEffect(() => {
    fetch("/api/imports?limit=10")
      .then((r) => r.json())
      .then((data) => {
        const list: ImportJob[] = data?.imports ?? (Array.isArray(data) ? data : []);
        setImports(list.slice(0, 10));
        setStats({
          total: list.length,
          completed: list.filter((j) => j.status === "COMPLETED").length,
          failed: list.filter((j) => j.status === "FAILED").length,
          totalRecords: list.reduce((s, j) => s + (j.successRows ?? 0), 0),
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Template download
  function downloadTemplate(type: string) {
    setDownloading(type);
    const url = `/api/templates?type=${type}`;
    const a = document.createElement("a");
    a.href = url;
    a.click();
    setTimeout(() => setDownloading(null), 1500);
    toast.success("Template downloaded");
  }

  // Drag-and-drop on upload zone — redirects to wizard
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext ?? "")) {
      toast.error("Unsupported file type. Use .csv, .xlsx, or .xls");
      return;
    }
    router.push("/imports/new");
  }, [router]);

  return (
    <div style={{ padding: "32px", maxWidth: 1000, minHeight: "100vh" }}>

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 32 }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Upload size={16} color="white" />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
                Import Center
              </h1>
            </div>
            <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 520 }}>
              Import customers, CA staff, firms, and assignments from CSV or Excel.
              Migrate from Excel, Zoho, Tally, or Google Sheets in minutes.
            </p>
          </div>
          <Link
            href="/imports/new"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 18px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "white", borderRadius: 10,
              fontSize: 14, fontWeight: 600,
              textDecoration: "none", flexShrink: 0,
              boxShadow: "0 2px 8px #6366f140",
            }}
          >
            <Upload size={14} />
            New Import
          </Link>
        </div>
      </motion.div>

      {/* ── Quick Stats ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}
      >
        {[
          { label: "Total Imports", value: loading ? "—" : stats.total, icon: <History size={16} />, color: "#6366f1" },
          { label: "Completed", value: loading ? "—" : stats.completed, icon: <CheckCircle2 size={16} />, color: "#10b981" },
          { label: "Failed", value: loading ? "—" : stats.failed, icon: <XCircle size={16} />, color: "#ef4444" },
          { label: "Records Imported", value: loading ? "—" : stats.totalRecords.toLocaleString(), icon: <Sparkles size={16} />, color: "#f59e0b" },
        ].map((s) => (
          <div key={s.label} style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 12, padding: "16px 18px",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: `${s.color}15`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: s.color, flexShrink: 0,
            }}>
              {s.icon}
            </div>
            <div>
              <p style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
                {s.value}
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{s.label}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── Download Templates ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ marginBottom: 28 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Download size={15} color="var(--text-muted)" />
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
            Download Templates
          </h2>
          <span style={{
            fontSize: 11, padding: "2px 8px", borderRadius: 20,
            background: "#6366f115", color: "#6366f1", fontWeight: 600,
          }}>
            9 templates
          </span>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
          Download a CSV template, fill in your data, then upload it below.
          Each template includes sample rows and all supported fields.
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 14,
        }}>
          {TEMPLATES.map((tpl, i) => {
            const Icon = tpl.icon;
            const isDownloading = downloading === tpl.type;
            return (
              <motion.div
                key={tpl.type}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.04 }}
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 14, padding: "18px 20px",
                  display: "flex", flexDirection: "column", gap: 12,
                  cursor: "pointer",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = tpl.color + "60";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 16px ${tpl.color}10`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                }}
              >
                {/* Card header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: tpl.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Icon size={18} color={tpl.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                      {tpl.title}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                      {tpl.fields.length} fields
                    </p>
                  </div>
                </div>

                {/* Description */}
                <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  {tpl.description}
                </p>

                {/* Fields preview */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {tpl.fields.slice(0, 4).map((f) => (
                    <span key={f} style={{
                      fontSize: 10, fontFamily: "monospace",
                      padding: "2px 7px", borderRadius: 4,
                      background: "var(--bg-elevated)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border)",
                    }}>
                      {f}
                    </span>
                  ))}
                  {tpl.fields.length > 4 && (
                    <span style={{
                      fontSize: 10, padding: "2px 7px", borderRadius: 4,
                      color: "var(--text-muted)",
                    }}>
                      +{tpl.fields.length - 4} more
                    </span>
                  )}
                </div>

                {/* Download button */}
                <button
                  onClick={() => downloadTemplate(tpl.type)}
                  disabled={!!isDownloading}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 7, padding: "9px 14px",
                    background: isDownloading ? `${tpl.color}10` : tpl.bg,
                    color: tpl.color,
                    border: `1px solid ${tpl.color}30`,
                    borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: isDownloading ? "not-allowed" : "pointer",
                    transition: "background 0.15s",
                    marginTop: 2,
                  }}
                >
                  {isDownloading
                    ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Downloading…</>
                    : <><Download size={13} /> Download {tpl.title}</>
                  }
                </button>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* ── Upload Zone ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        style={{ marginBottom: 28 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Upload size={15} color="var(--text-muted)" />
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
            Start New Import
          </h2>
        </div>

        <div
          ref={dropRef}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? "#6366f1" : "var(--border)"}`,
            borderRadius: 16,
            padding: "40px 32px",
            textAlign: "center",
            background: isDragging ? "#6366f108" : "var(--bg-surface)",
            transition: "all 0.2s",
            cursor: "pointer",
          }}
          onClick={() => router.push("/imports/new")}
        >
          <AnimatePresence mode="wait">
            {isDragging ? (
              <motion.div
                key="dragging"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: "#6366f120",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px",
                }}>
                  <Upload size={24} color="#6366f1" />
                </div>
                <p style={{ fontSize: 17, fontWeight: 700, color: "#6366f1" }}>
                  Drop your file here
                </p>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
                  We'll open the import wizard for you
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: "var(--bg-elevated)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px",
                }}>
                  <FileSpreadsheet size={24} color="var(--text-muted)" />
                </div>
                <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                  Drop your CSV or Excel file here
                </p>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
                  or click to open the Import Wizard
                </p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>
                  Supports .csv, .xlsx, .xls · Max 50 MB · Up to 10,000+ rows
                </p>

                {/* Step pills */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 6, marginTop: 20, flexWrap: "wrap",
                }}>
                  {["Upload", "Detect Columns", "Map Fields", "Validate", "Import"].map((s, i) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{
                        fontSize: 11, padding: "4px 10px", borderRadius: 20,
                        background: "var(--bg-elevated)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border)",
                        fontWeight: 500,
                      }}>
                        {i + 1}. {s}
                      </span>
                      {i < 4 && <ChevronRight size={10} color="var(--text-muted)" />}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Info row */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 8,
          marginTop: 10, padding: "10px 14px",
          background: "#6366f108",
          border: "1px solid #6366f120",
          borderRadius: 10,
        }}>
          <Info size={14} color="#6366f1" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "#6366f1", lineHeight: 1.5 }}>
            <strong>Tip:</strong> Download a template first, fill it with your data, then upload.
            The wizard auto-detects columns and lets you map them to FinRP fields.
            Large imports (10,000+ rows) are processed in the background.
          </p>
        </div>
      </motion.div>

      {/* ── Recent Imports ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <History size={15} color="var(--text-muted)" />
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              Recent Imports
            </h2>
          </div>
          <Link
            href="/imports"
            style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 13, color: "#6366f1",
              textDecoration: "none", fontWeight: 500,
            }}
          >
            View All <ArrowRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div style={{
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: 14, overflow: "hidden",
          }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{
                padding: "16px 24px",
                borderBottom: i < 2 ? "1px solid var(--border)" : "none",
                display: "flex", alignItems: "center", gap: 16,
              }}>
                <div style={{ width: 180, height: 14, background: "var(--bg-elevated)", borderRadius: 4 }} />
                <div style={{ width: 80, height: 14, background: "var(--bg-elevated)", borderRadius: 4 }} />
                <div style={{ width: 60, height: 14, background: "var(--bg-elevated)", borderRadius: 4 }} />
              </div>
            ))}
          </div>
        ) : imports.length === 0 ? (
          <div style={{
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: 14, padding: "48px 32px", textAlign: "center",
          }}>
            <History size={40} color="var(--text-muted)" style={{ margin: "0 auto 12px", opacity: 0.3 }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
              No imports yet
            </p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
              Download a template, fill it in, and start your first import
            </p>
            <Link
              href="/imports/new"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 18px",
                background: "#6366f1", color: "white",
                borderRadius: 8, fontSize: 13, fontWeight: 600,
                textDecoration: "none",
              }}
            >
              <Upload size={13} /> Start First Import
            </Link>
          </div>
        ) : (
          <div style={{
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: 14, overflow: "hidden",
          }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}>
                    {["File", "Type", "Status", "Records", "Date", ""].map((h) => (
                      <th key={h} style={{
                        textAlign: "left", padding: "10px 20px",
                        fontSize: 11, fontWeight: 600,
                        color: "var(--text-muted)",
                        textTransform: "uppercase", letterSpacing: "0.05em",
                        whiteSpace: "nowrap",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {imports.map((job, i) => {
                    const meta = statusMeta(job.status);
                    const StatusIcon = meta.icon;
                    return (
                      <tr
                        key={job.id}
                        style={{
                          borderTop: i > 0 ? "1px solid var(--border)" : "none",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "13px 20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <FileSpreadsheet size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                            <div>
                              <p style={{
                                fontSize: 13, fontWeight: 500, color: "var(--text-primary)",
                                maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>
                                {job.originalName}
                              </p>
                              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                {formatBytes(job.fileSize)} · {job.type}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "13px 20px" }}>
                          <span style={{
                            fontSize: 11, padding: "3px 9px", borderRadius: 20,
                            background: "var(--bg-elevated)",
                            color: "var(--text-secondary)",
                            border: "1px solid var(--border)",
                            fontWeight: 500,
                          }}>
                            {entityLabel(job.entity)}
                          </span>
                        </td>
                        <td style={{ padding: "13px 20px" }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            fontSize: 11, fontWeight: 600,
                            padding: "3px 9px", borderRadius: 20,
                            color: meta.color, background: `${meta.color}12`,
                          }}>
                            <StatusIcon size={10} />
                            {meta.label}
                          </span>
                        </td>
                        <td style={{ padding: "13px 20px" }}>
                          <span style={{ color: "#10b981", fontWeight: 600 }}>
                            {job.successRows.toLocaleString()}
                          </span>
                          <span style={{ color: "var(--text-muted)" }}>
                            /{job.totalRows.toLocaleString()}
                          </span>
                          {job.failedRows > 0 && (
                            <span style={{ color: "#ef4444", marginLeft: 6, fontSize: 11 }}>
                              ({job.failedRows} failed)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "13px 20px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {timeAgo(job.createdAt)}
                        </td>
                        <td style={{ padding: "13px 20px" }}>
                          <Link
                            href={`/imports/${job.id}`}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              fontSize: 12, color: "#6366f1",
                              textDecoration: "none", fontWeight: 600,
                            }}
                          >
                            View <ChevronRight size={11} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>

      {/* spin keyframes */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
