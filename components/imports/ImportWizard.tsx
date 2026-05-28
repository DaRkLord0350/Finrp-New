"use client";

// ============================================================
// FinRP — Import Wizard
// Multi-step import flow:
//   1. Upload — drag-drop file
//   2. Detect — preview detected headers + sample rows
//   3. Map    — column mapper (ColumnMapper component)
//   4. Import — progress stream (useImportProgress)
//   5. Results — summary + download errors
// ============================================================

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Table,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  RefreshCw,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColumnMapper } from "./ColumnMapper";
import { useImportProgress } from "@/hooks/useImportProgress";
import { cn } from "@/lib/utils";
import type { MappingRule } from "@/lib/connectors/base/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WizardStep = "upload" | "detect" | "map" | "import" | "results";

const STEP_ORDER: WizardStep[] = ["upload", "detect", "map", "import", "results"];

const ACCEPTED_EXTS = [".csv", ".xlsx", ".xls"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

interface DetectResult {
  importJobId: string;
  detectedColumns: string[];
  suggestedMappings: Record<string, string>;
  sampleRows: Record<string, string>[];
  needsMapping: boolean;
}

interface ImportResultSummary {
  totalRows: number;
  successRows: number;
  failedRows: number;
  duplicateRows: number;
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEP_META: Record<WizardStep, { label: string; icon: React.FC<{ className?: string }> }> = {
  upload: { label: "Upload", icon: Upload },
  detect: { label: "Preview", icon: Table },
  map: { label: "Map Fields", icon: ArrowRight },
  import: { label: "Importing", icon: RefreshCw },
  results: { label: "Complete", icon: CheckCircle2 },
};

function StepIndicator({ current }: { current: WizardStep }) {
  const currentIdx = STEP_ORDER.indexOf(current);
  return (
    <div className="flex items-center gap-0.5 mb-8">
      {STEP_ORDER.map((step, i) => {
        const { label, icon: Icon } = STEP_META[step];
        const isDone = i < currentIdx;
        const isActive = i === currentIdx;
        return (
          <div key={step} className="flex items-center">
            <div className={cn(
              "flex flex-col items-center gap-1",
              "min-w-[60px] text-center",
            )}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                isDone && "bg-primary text-primary-foreground",
                isActive && "bg-primary/20 text-primary border-2 border-primary",
                !isDone && !isActive && "bg-muted text-muted-foreground"
              )}>
                {isDone
                  ? <CheckCircle2 className="h-4 w-4" />
                  : <Icon className="h-4 w-4" />
                }
              </div>
              <span className={cn(
                "text-[10px] font-medium leading-tight",
                isActive ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground"
              )}>{label}</span>
            </div>
            {i < STEP_ORDER.length - 1 && (
              <div className={cn(
                "flex-1 h-px mx-1 transition-colors",
                i < currentIdx ? "bg-primary" : "bg-muted"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

const ENTITY_OPTIONS = [
  { value: "CUSTOMERS", label: "Customers" },
  { value: "VENDORS", label: "Vendors / Suppliers" },
  { value: "INVOICES", label: "Invoices" },
  { value: "PRODUCTS", label: "Products / Inventory" },
  { value: "EMPLOYEES", label: "Employees" },
  { value: "EXPENSES", label: "Expenses" },
];

export function ImportWizard() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("upload");
  const [entity, setEntity] = useState("CUSTOMERS");
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [detectResult, setDetectResult] = useState<DetectResult | null>(null);
  const [mappingRules, setMappingRules] = useState<MappingRule[]>([]);
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResultSummary | null>(null);

  // SSE progress
  const { progress } = useImportProgress(
    step === "import" ? importJobId : null,
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

  // ── Native file input + drag-and-drop ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const acceptFile = useCallback((f: File) => {
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXTS.includes(ext)) {
      setUploadError(`Unsupported file type "${ext}". Use .csv, .xlsx or .xls.`);
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setUploadError("File exceeds 50 MB limit.");
      return;
    }
    setFile(f);
    setUploadError(null);
  }, []);

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragActive(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) acceptFile(dropped);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) acceptFile(picked);
    // Reset so re-selecting same file triggers onChange again
    e.target.value = "";
  }

  // ── Upload handler ──
  async function handleUpload() {
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entity", entity);

      const res = await fetch("/api/imports", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Upload failed");
      }

      const data = await res.json() as DetectResult & { importJobId: string; suggestedMappings?: Record<string, string> };

      setDetectResult({
        importJobId: data.importJobId,
        detectedColumns: data.detectedColumns,
        suggestedMappings: data.suggestedMappings ?? {},
        sampleRows: [],
        needsMapping: data.needsMapping,
      });
      setImportJobId(data.importJobId);
      setStep("detect");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  // ── Start import after mapping ──
  async function handleStartImport() {
    if (!importJobId || mappingRules.length === 0) return;

    try {
      // Save mapping to the import job
      const patchRes = await fetch(`/api/imports/${importJobId}/mapping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldMapping: mappingRules }),
      });

      if (!patchRes.ok) throw new Error("Failed to save field mapping");

      setStep("import");
    } catch (err) {
      console.error("Failed to start import:", err);
    }
  }

  // ── Download errors ──
  function downloadErrors() {
    if (!importJobId) return;
    window.location.href = `/api/imports/${importJobId}/download-errors`;
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ---------------------------------------------------------------------------
  // Render steps
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <StepIndicator current={step} />

      <AnimatePresence mode="wait">
        {/* ── STEP 1: Upload ── */}
        {step === "upload" && (
          <motion.div key="upload" {...slideProps}>
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Upload File</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Import customers, invoices, or products from a CSV or Excel file.
                </p>
              </div>

              {/* Entity selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">What are you importing?</label>
                <Select value={entity} onValueChange={setEntity}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Drop zone */}
              <div
                role="button"
                tabIndex={0}
                aria-label="File upload area"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
                  "hover:border-primary hover:bg-primary/5",
                  isDragActive && "border-primary bg-primary/10",
                  file && "border-green-500 bg-green-50/50 dark:bg-green-950/20"
                )}
              >
                {/* Hidden native file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="sr-only"
                  onChange={handleInputChange}
                />
                <FileSpreadsheet className={cn(
                  "h-12 w-12 mx-auto mb-4",
                  file ? "text-green-500" : "text-muted-foreground"
                )} />

                {file ? (
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400">{file.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">{formatBytes(file.size)}</p>
                    <p className="text-xs text-muted-foreground mt-2">Click or drag to replace</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium">Drop your CSV or Excel file here</p>
                    <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-3">
                      Supports .csv, .xlsx, .xls — max 50 MB
                    </p>
                  </div>
                )}
              </div>

              {uploadError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {uploadError}
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 2: Detect ── */}
        {step === "detect" && detectResult && (
          <motion.div key="detect" {...slideProps}>
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Detected Columns</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  We found {detectResult.detectedColumns.length} columns in your file.
                  Review them before mapping.
                </p>
              </div>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex flex-wrap gap-2">
                    {detectResult.detectedColumns.map((col) => (
                      <Badge key={col} variant="secondary" className="font-mono text-xs">
                        {col}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("upload")}>
                  Back
                </Button>
                <Button onClick={() => setStep("map")} className="flex-1">
                  Map Fields
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STEP 3: Map ── */}
        {step === "map" && detectResult && (
          <motion.div key="map" {...slideProps}>
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Map Columns to Fields</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Tell FinRP which column corresponds to which field.
                  We've auto-suggested some mappings based on column names.
                </p>
              </div>

              <ColumnMapper
                sourceHeaders={detectResult.detectedColumns}
                entity={entity}
                suggestedMappings={detectResult.suggestedMappings}
                onChange={setMappingRules}
                onSave={handleStartImport}
              />

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("detect")}>
                  Back
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STEP 4: Import ── */}
        {step === "import" && (
          <motion.div key="import" {...slideProps}>
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-semibold">Importing…</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Your file is being processed. This may take a few minutes for large files.
                </p>
              </div>

              <div className="space-y-4">
                <Progress value={progress?.progress ?? 0} className="h-3" />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{progress?.progress ?? 0}% complete</span>
                  {progress && (
                    <span>
                      {progress.processedRows.toLocaleString()} / {progress.totalRows.toLocaleString()} rows
                    </span>
                  )}
                </div>
              </div>

              {progress && (
                <div className="grid grid-cols-3 gap-4">
                  <StatCard
                    label="Imported"
                    value={progress.successRows}
                    variant="success"
                  />
                  <StatCard
                    label="Failed"
                    value={progress.failedRows}
                    variant="error"
                  />
                  <StatCard
                    label="Duplicates"
                    value={progress.duplicateRows}
                    variant="warning"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Processing rows…
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STEP 5: Results ── */}
        {step === "results" && importResult && (
          <motion.div key="results" {...slideProps}>
            <div className="space-y-8">
              <div className="text-center">
                {importResult.failedRows === 0 ? (
                  <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                ) : importResult.successRows === 0 ? (
                  <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
                ) : (
                  <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
                )}

                <h2 className="text-2xl font-semibold">
                  {importResult.failedRows === 0
                    ? "Import Complete!"
                    : importResult.successRows === 0
                    ? "Import Failed"
                    : "Import Partially Complete"}
                </h2>
                <p className="text-muted-foreground mt-2">
                  {importResult.failedRows === 0
                    ? `Successfully imported all ${importResult.successRows.toLocaleString()} records.`
                    : `${importResult.successRows.toLocaleString()} records imported, ${importResult.failedRows.toLocaleString()} failed.`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Total" value={importResult.totalRows} variant="default" />
                <StatCard label="Imported" value={importResult.successRows} variant="success" />
                <StatCard label="Failed" value={importResult.failedRows} variant="error" />
                <StatCard label="Duplicates" value={importResult.duplicateRows} variant="warning" />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                {importResult.failedRows > 0 && (
                  <Button
                    variant="outline"
                    onClick={downloadErrors}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Error Report
                  </Button>
                )}
                <Button
                  onClick={() => router.push("/imports")}
                  className="flex-1"
                >
                  View Import History
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "default" | "success" | "error" | "warning";
}) {
  const colors = {
    default: "text-foreground",
    success: "text-green-600 dark:text-green-400",
    error: "text-destructive",
    warning: "text-amber-600 dark:text-amber-400",
  };

  return (
    <Card>
      <CardContent className="pt-4 text-center">
        <p className={cn("text-2xl font-bold", colors[variant])}>
          {value.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------
const slideProps = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.2 },
};
