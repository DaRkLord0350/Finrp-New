// ============================================================
// FinRP — Import BullMQ Worker
// Processes ImportJob records: reads file, applies mapping,
// validates, stages rows, commits to DB.
// Reports progress as BullMQ job progress (0–100).
// ============================================================

import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "@/lib/redis";
import { QUEUE_NAMES, type ImportJobData } from "@/lib/jobs/queues";
import { prisma } from "@/lib/prisma";
import { ETLPipeline } from "@/lib/etl/pipeline";
import { parseCSVFile } from "@/lib/connectors/csv/parser";
import { parseExcelFile } from "@/lib/connectors/excel/parser";
import type { MappingRule } from "@/lib/connectors/base/types";

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

export function createImportWorker() {
  const worker = new Worker<ImportJobData>(
    QUEUE_NAMES.IMPORT,
    async (job: Job<ImportJobData>) => {
      return processImportJob(job);
    },
    {
      connection: getRedisConnection("worker"),
      concurrency: 3,             // process 3 imports in parallel
      limiter: {
        max: 10,
        duration: 60_000,         // max 10 imports/minute
      },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[ImportWorker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[ImportWorker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[ImportWorker] Worker error:", err);
  });

  return worker;
}

// ---------------------------------------------------------------------------
// Core processor
// ---------------------------------------------------------------------------

async function processImportJob(job: Job<ImportJobData>): Promise<void> {
  const { importJobId, organizationId, entity, options } = job.data;

  // ── 1. Fetch the ImportJob record ──
  const importJob = await prisma.importJob.findUnique({
    where: { id: importJobId },
  });

  if (!importJob) {
    throw new Error(`ImportJob ${importJobId} not found`);
  }
  if (importJob.organizationId !== organizationId) {
    throw new Error("ImportJob does not belong to this organization");
  }
  if (importJob.status === "COMPLETED" || importJob.status === "CANCELLED") {
    console.warn(`[ImportWorker] Job ${importJobId} already ${importJob.status}, skipping`);
    return;
  }

  // ── 2. Mark as PROCESSING ──
  await prisma.importJob.update({
    where: { id: importJobId },
    data: { status: "PROCESSING", startedAt: new Date(), bullmqJobId: job.id },
  });

  await job.updateProgress(5);

  try {
    // ── 3. Parse the file ──
    const mimeType = importJob.mimeType.toLowerCase();
    const isExcel = mimeType.includes("spreadsheet") ||
      mimeType.includes("excel") ||
      importJob.filePath.endsWith(".xlsx") ||
      importJob.filePath.endsWith(".xls");

    let rows: Record<string, string>[];
    let headers: string[];

    if (isExcel) {
      const parsed = await parseExcelFile(importJob.filePath);
      rows = parsed.rows;
      headers = parsed.headers;
    } else {
      const parsed = await parseCSVFile(importJob.filePath);
      rows = parsed.rows;
      headers = parsed.headers;
    }

    if (rows.length === 0) {
      await prisma.importJob.update({
        where: { id: importJobId },
        data: { status: "COMPLETED", completedAt: new Date(), totalRows: 0 },
      });
      return;
    }

    // Update total count
    await prisma.importJob.update({
      where: { id: importJobId },
      data: { totalRows: rows.length, detectedColumns: headers },
    });

    await job.updateProgress(15);

    // ── 4. Resolve field mapping rules ──
    const rules = await resolveFieldMappingRules(importJob, organizationId);

    if (rules.length === 0) {
      await prisma.importJob.update({
        where: { id: importJobId },
        data: { status: "MAPPING" },
      });
      // Job pauses here — frontend must provide mapping, then re-trigger
      return;
    }

    await job.updateProgress(20);

    // ── 5. Run ETL Pipeline ──
    const pipeline = new ETLPipeline();
    const entityType = mapImportEntity(entity || importJob.entity);

    await pipeline.run(rows, {
      importJobId,
      organizationId,
      entity: entityType,
      rules,
      chunkSize: 100,
      onProgress: async (progress, message) => {
        // Scale pipeline progress from 20→100
        const scaled = Math.round(20 + (progress / 100) * 80);
        await job.updateProgress(Math.min(scaled, 99));
        if (message) {
          await job.log(message);
        }
      },
    });

    await job.updateProgress(100);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
      },
    });
    throw err; // Re-throw for BullMQ retry machinery
  }
}

// ---------------------------------------------------------------------------
// Resolve mapping rules from ImportJob.fieldMapping or default FieldMapping
// ---------------------------------------------------------------------------

async function resolveFieldMappingRules(
  importJob: { id: string; organizationId: string; entity: string; fieldMapping: unknown; type: string },
  organizationId: string
): Promise<MappingRule[]> {
  // If fieldMapping is embedded in the job record, use it directly
  if (importJob.fieldMapping && Array.isArray(importJob.fieldMapping)) {
    return importJob.fieldMapping as MappingRule[];
  }

  // Look for a saved default FieldMapping for this entity
  const saved = await prisma.fieldMapping.findFirst({
    where: {
      organizationId,
      entity: importJob.entity as "CUSTOMERS" | "INVOICES" | "PRODUCTS" | "EMPLOYEES" | "VENDORS" | "EXPENSES" | "PAYMENTS" | "LEADS",
      isDefault: true,
    },
  });

  if (saved) {
    return saved.mappings as unknown as MappingRule[];
  }

  return []; // No mapping — job will pause in MAPPING status
}

// ---------------------------------------------------------------------------
// Map ImportEntity enum → ETL entity string
// ---------------------------------------------------------------------------

function mapImportEntity(
  entity: string
): "customer" | "invoice" | "product" | "employee" {
  const map: Record<string, "customer" | "invoice" | "product" | "employee"> = {
    CUSTOMERS: "customer",
    VENDORS: "customer",
    INVOICES: "invoice",
    PRODUCTS: "product",
    EMPLOYEES: "employee",
  };
  return map[entity.toUpperCase()] ?? "customer";
}
