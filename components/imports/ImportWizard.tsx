"use client";

// ============================================================
// FinRP — Import Wizard
// Multi-step import flow:
//   1. Upload → 2. Detect → 3. Map → 4. Import → 5. Results
//
// Hardened against:
//   • Duplicate submits (isSavingMapping guard)
//   • Stuck imports (STUCK event → actionable UI + retry)
//   • Worker failures (FAILED status → retry path)
//   • SSE disconnection (reconnect with backoff)
// ============================================================

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Table, ArrowRight, CheckCircle2, XCircle,
  AlertCircle, Download, RefreshCw, FileSpreadsheet,
  AlertTriangle, ExternalLink, Bug,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ColumnMapper } from "./ColumnMapper";
import { useImportProgress, type StuckEvent } from "@/hooks/useImportProgress";
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
  importJobId:       string;
  detectedColumns:   string[];
  suggestedMappings: Record<string, string>;
  sampleRows:        Record<string, string>[];
  needsMapping:      boolean;
}

interface ImportResultSummary {
  totalRows:     number;
  successRows:   number;
  failedRows:    number;
  duplicateRows: number;
  status:        string;
  error:         string | null;
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEP_META: Record<WizardStep, { label: string; icon: React.FC<{ className?: string }> }> = {
  upload:  { label: "Upload",    icon: Upload },
  detect:  { label: "Preview",   icon: Table },
  map:     { label: "Map Fields", icon: ArrowRight },
  import:  { label: "Importing", icon: RefreshCw },
  results: { label: "Complete",  icon: CheckCircle2 },
};

function StepIndicator({ current }: { current: WizardStep }) {
  const currentIdx = STEP_ORDER.indexOf(current);
  return (
    <div className="flex items-center gap-0.5 mb-8">
      {STEP_ORDER.map((step, i) => {
        const { label, icon: Icon } = STEP_META[step];
        const isDone   = i < currentIdx;
        const isActive = i === currentIdx;
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center gap-1 min-w-[60px] text-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                isDone   && "bg-primary text-primary-foreground",
                isActive && "bg-primary/20 text-primary border-2 border-primary",
                !isDone && !isActive && "bg-muted text-muted-foreground"
              )}>
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
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
// Entity selector
// ---------------------------------------------------------------------------

const ENTITY_OPTIONS = [
  { value: "CUSTOMERS",     label: "Customers" },
  { value: "CA_USERS",      label: "CA Users (Staff)" },
  { value: "FIRMS",         label: "CA Firms" },
  { value: "ASSIGNMENTS",   label: "CA-Customer Assignments" },
  { value: "MASTER_IMPORT", label: "Master Import (Customer + Assign)" },
  { value: "VENDORS",       label: "Vendors / Suppliers" },
  { value: "INVOICES",      label: "Invoices" },
  { value: "PRODUCTS",      label: "Products / Inventory" },
  { value: "EMPLOYEES",     label: "Employees" },
];

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export function ImportWizard({
  initialEntity    = "CUSTOMERS",
  hideEntitySelector = false,
}: {
  initialEntity?:      string;
  hideEntitySelector?: boolean;
}) {
  const router = useRouter();

  const [step,          setStep]          = useState<WizardStep>("upload");
  const [entity,        setEntity]        = useState(initialEntity);
  const [file,          setFile]          = useState<File | null>(null);
  const [uploadError,   setUploadError]   = useState<string | null>(null);
  const [isUploading,   setIsUploading]   = useState(false);
  const [detectResult,  setDetectResult]  = useState<DetectResult | null>(null);
  const [mappingRules,  setMappingRules]  = useState<MappingRule[]>([]);
  const [importJobId,   setImportJobId]   = useState<string | null>(null);
  const [importResult,  setImportResult]  = useState<ImportResultSummary | null>(null);
  const [mappingError,  setMappingError]  = useState<string | null>(null);
  const [isSavingMapping, setIsSavingMapping] = useState(false);
  const [stuckEvent,    setStuckEvent]    = useState<StuckEvent | null>(null);

  // Prevent double-submit from button or keyboard
  const savingRef = useRef(false);

  // ── SSE progress ──────────────────────────────────────────────────────────
  const {
    progress,
    isStuck,
    error: progressError,
  } = useImportProgress(
    step === "import" ? importJobId : null,
    {
      onComplete: (p) => {
        setImportResult({
          totalRows:     p.totalRows,
          successRows:   p.successRows,
          failedRows:    p.failedRows,
          duplicateRows: p.duplicateRows,
          status:        p.status,
          error:         p.error,
        });
        setStep("results");
      },
      onStuck: (evt) => {
        setStuckEvent(evt);
      },
    }
  );

  // ── File input ─────────────────────────────────────────────────────────────
  const fileInputRef  = useRef<HTMLInputElement>(null);
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

  function handleDragEnter(e: React.DragEvent)  { e.preventDefault(); e.stopPropagation(); setIsDragActive(true); }
  function handleDragLeave(e: React.DragEvent)  { e.preventDefault(); e.stopPropagation(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragActive(false); }
  function handleDragOver(e: React.DragEvent)   { e.preventDefault(); e.stopPropagation(); }
  function handleDrop(e: React.DragEvent)        { e.preventDefault(); e.stopPropagation(); setIsDragActive(false); const f = e.dataTransfer.files[0]; if (f) acceptFile(f); }
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (f) acceptFile(f); e.target.value = ""; }

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function handleUpload() {
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entity", entity);

      const res = await fetch("/api/imports", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Upload failed");
      }

      const data = await res.json() as DetectResult & { importJobId: string; suggestedMappings?: Record<string, string> };

      setDetectResult({
        importJobId:       data.importJobId,
        detectedColumns:   data.detectedColumns,
        suggestedMappings: data.suggestedMappings ?? {},
        sampleRows:        [],
        needsMapping:      data.needsMapping,
      });
      setImportJobId(data.importJobId);
      setStep("detect");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  // ── Start import (called by ColumnMapper's onSave) ────────────────────────
  async function handleStartImport(rulesFromMapper?: MappingRule[]) {
    // Accept rules directly from ColumnMapper to avoid stale closure
    const rules = rulesFromMapper ?? mappingRules;
    if (!importJobId || rules.length === 0 || savingRef.current) return;

    savingRef.current = true;
    setMappingError(null);
    setIsSavingMapping(true);
    setStuckEvent(null);

    try {
      console.log(
        "[IMPORTWIZARD] fieldMapping",
        rules,
        Array.isArray(rules),
        rules?.length
      );
      const payload = { fieldMapping: rules };
      console.log(
        "[FRONTEND PAYLOAD]",
        JSON.stringify(payload, null, 2)
      );
      const res = await fetch(`/api/imports/${importJobId}/mapping`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ fieldMapping: rules }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server error ${res.status}`);
      }

      setStep("import");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start import";
      setMappingError(message);
      console.error("[ImportWizard] Failed to start import:", err);
    } finally {
      setIsSavingMapping(false);
      savingRef.current = false;
    }
  }

  // ── Retry after stuck/failed ───────────────────────────────────────────────
  function handleRetryMapping() {
    setStuckEvent(null);
    setStep("map");
  }

  function handleStartFresh() {
    setStep("upload");
    setFile(null);
    setDetectResult(null);
    setImportJobId(null);
    setImportResult(null);
    setMappingRules([]);
    setMappingError(null);
    setStuckEvent(null);
  }

  function downloadErrors() {
    if (!importJobId) return;
    window.location.href = `/api/imports/${importJobId}/download-errors`;
  }

  function openDebugLog() {
    if (!importJobId) return;
    window.open(`/api/imports/${importJobId}/debug`, "_blank");
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024)             return `${bytes} B`;
    if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ── Status label ──────────────────────────────────────────────────────────
  function statusLabel(status: string | undefined) {
    switch (status) {
      case "QUEUED":     return "Waiting in queue…";
      case "PENDING":    return "Queuing job…";
      case "PROCESSING": return "Processing rows…";
      default:           return "Processing…";
    }
  }

  // ---------------------------------------------------------------------------
  // Render
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

              {!hideEntitySelector && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">What are you importing?</label>
                  <Select value={entity} onValueChange={setEntity}>
                    <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ENTITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div
                role="button" tabIndex={0} aria-label="File upload area"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}   onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
                  "hover:border-primary hover:bg-primary/5",
                  isDragActive && "border-primary bg-primary/10",
                  file && "border-green-500 bg-green-50/50 dark:bg-green-950/20"
                )}
              >
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="sr-only" onChange={handleInputChange} />
                <FileSpreadsheet className={cn("h-12 w-12 mx-auto mb-4", file ? "text-green-500" : "text-muted-foreground")} />
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
                    <p className="text-xs text-muted-foreground mt-3">Supports .csv, .xlsx, .xls — max 50 MB</p>
                  </div>
                )}
              </div>

              {uploadError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />{uploadError}
                </div>
              )}

              <Button onClick={handleUpload} disabled={!file || isUploading} className="w-full">
                {isUploading ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Uploading…</> : "Continue"}
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
                </p>
              </div>
              <Card><CardContent className="pt-4">
                <div className="flex flex-wrap gap-2">
                  {detectResult.detectedColumns.map((col) => (
                    <Badge key={col} variant="secondary" className="font-mono text-xs">{col}</Badge>
                  ))}
                </div>
              </CardContent></Card>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
                <Button onClick={() => setStep("map")} className="flex-1">
                  Map Fields <ArrowRight className="ml-2 h-4 w-4" />
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
                </p>
              </div>

              <ColumnMapper
                sourceHeaders={detectResult.detectedColumns}
                entity={entity}
                suggestedMappings={detectResult.suggestedMappings}
                onChange={setMappingRules}
                onSave={handleStartImport}
                isSaving={isSavingMapping}
              />

              {mappingError && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Failed to start import</p>
                      <p className="text-sm text-destructive/80 mt-1">{mappingError}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Mapping rules are saved. You can resubmit safely.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("detect")} disabled={isSavingMapping}>
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
              {/* Stuck state */}
              {(isStuck || stuckEvent) && (
                <div className="rounded-xl border border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                        Import Stuck
                      </h3>
                      <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                        {stuckEvent?.message ?? progressError ?? "Import is taking too long."}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={handleRetryMapping}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry Mapping
                    </Button>
                    <Button size="sm" variant="outline" onClick={openDebugLog}>
                      <Bug className="mr-2 h-4 w-4" />
                      View Diagnostics
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => router.push("/imports/queue-health")}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Queue Health
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleStartFresh}>
                      Start Fresh
                    </Button>
                  </div>
                </div>
              )}

              {/* Normal progress (hide when stuck) */}
              {!isStuck && !stuckEvent && (
                <>
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
                      <StatCard label="Imported"   value={progress.successRows}   variant="success" />
                      <StatCard label="Failed"      value={progress.failedRows}    variant="error" />
                      <StatCard label="Duplicates"  value={progress.duplicateRows} variant="warning" />
                    </div>
                  )}

                  {progressError ? (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {progressError}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {statusLabel(progress?.status)}
                    </div>
                  )}

                  {/* Non-spinning debug link while running */}
                  {importJobId && (
                    <button
                      onClick={openDebugLog}
                      className="text-xs text-muted-foreground/60 hover:text-muted-foreground underline-offset-4 hover:underline"
                    >
                      View diagnostics
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* ── STEP 5: Results ── */}
        {step === "results" && importResult && (
          <motion.div key="results" {...slideProps}>
            <div className="space-y-8">
              <div className="text-center">
                {importResult.status === "FAILED" ? (
                  <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
                ) : importResult.failedRows === 0 ? (
                  <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                ) : importResult.successRows === 0 ? (
                  <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
                ) : (
                  <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
                )}

                <h2 className="text-2xl font-semibold">
                  {importResult.status === "FAILED"
                    ? "Import Failed"
                    : importResult.failedRows === 0
                    ? "Import Complete!"
                    : importResult.successRows === 0
                    ? "Import Failed"
                    : "Import Partially Complete"}
                </h2>
                <p className="text-muted-foreground mt-2">
                  {importResult.status === "FAILED" && importResult.error
                    ? importResult.error
                    : importResult.failedRows === 0
                    ? `Successfully imported all ${importResult.successRows.toLocaleString()} records.`
                    : `${importResult.successRows.toLocaleString()} records imported, ${importResult.failedRows.toLocaleString()} failed.`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Total"      value={importResult.totalRows}     variant="default" />
                <StatCard label="Imported"   value={importResult.successRows}   variant="success" />
                <StatCard label="Failed"     value={importResult.failedRows}    variant="error" />
                <StatCard label="Duplicates" value={importResult.duplicateRows} variant="warning" />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                {importResult.failedRows > 0 && (
                  <Button variant="outline" onClick={downloadErrors} className="gap-2">
                    <Download className="h-4 w-4" />
                    Download Error Report
                  </Button>
                )}
                {importJobId && (
                  <Button variant="ghost" onClick={openDebugLog} className="gap-2">
                    <Bug className="h-4 w-4" />
                    View Logs
                  </Button>
                )}
                <Button onClick={() => router.push("/imports")} className="flex-1">
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

function StatCard({ label, value, variant }: {
  label: string; value: number;
  variant: "default" | "success" | "error" | "warning";
}) {
  const colors = {
    default: "text-foreground",
    success: "text-green-600 dark:text-green-400",
    error:   "text-destructive",
    warning: "text-amber-600 dark:text-amber-400",
  };
  return (
    <Card>
      <CardContent className="pt-4 text-center">
        <p className={cn("text-2xl font-bold", colors[variant])}>{value.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------
const slideProps = {
  initial:    { opacity: 0, x: 20 },
  animate:    { opacity: 1, x: 0 },
  exit:       { opacity: 0, x: -20 },
  transition: { duration: 0.2 },
};
