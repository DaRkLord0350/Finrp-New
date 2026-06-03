// ============================================================
// FinRP — Import BullMQ Worker
// Processes ImportJob records end-to-end.
//
// Guarantees:
//   • Every job path ends in COMPLETED, FAILED, PARTIAL, or CANCELLED
//   • No silent returns — any unexpected state throws so BullMQ retries
//   • Heartbeat updated every 10 s — stuck-job checker uses this
//   • DB always reflects true state — never leaves PROCESSING orphaned
// ============================================================

import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "@/lib/redis";
import { QUEUE_NAMES, type ImportJobData } from "@/lib/jobs/queues";
import { prisma } from "@/lib/prisma";
import { ETLPipeline, type PipelineEntity } from "@/lib/etl/pipeline";
import { parseCSVFile } from "@/lib/connectors/csv/parser";
import { parseExcelFile } from "@/lib/connectors/excel/parser";
import { assertLegalImportTransition } from "@/lib/import/state-machine";
import type { MappingRule } from "@/lib/connectors/base/types";

const HEARTBEAT_INTERVAL_MS = 10_000;

// ---------------------------------------------------------------------------
// Worker factory
// ---------------------------------------------------------------------------

export function createImportWorker() {
  const worker = new Worker<ImportJobData>(
    QUEUE_NAMES.IMPORT,
    processImportJob,
    {
      connection: getRedisConnection("worker"),
      concurrency: 3,
      limiter: { max: 10, duration: 60_000 },
      // Lock duration must exceed the longest possible heartbeat gap (10s * 3 = 30s)
      // We set it to 60s to give the heartbeat plenty of room
      lockDuration: 60_000,
    }
  );

  worker.on("ready", () => {
    console.log("[ImportWorker] Worker READY — listening for jobs");
  });

  worker.on("active", (job) => {
    console.log(
      `[ImportWorker] Job ACTIVE id=${job.id} importJobId=${job.data.importJobId} ` +
      `org=${job.data.organizationId}`
    );
  });

  worker.on("completed", (job, result) => {
    console.log(
      `[ImportWorker] Job COMPLETED id=${job.id} importJobId=${job.data.importJobId} ` +
      `result=${JSON.stringify(result ?? {})}`
    );
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[ImportWorker] Job FAILED id=${job?.id} importJobId=${job?.data?.importJobId} ` +
      `attempt=${job?.attemptsMade ?? "?"} error=${err.message}`
    );
  });

  worker.on("stalled", (jobId) => {
    console.warn(
      `[ImportWorker] Job STALLED id=${jobId} — lock expired, will be retried`
    );
  });

  worker.on("error", (err) => {
    console.error("[ImportWorker] Worker-level error:", err.message, err.stack);
  });

  return worker;
}

// ---------------------------------------------------------------------------
// Core processor
// ---------------------------------------------------------------------------

async function processImportJob(job: Job<ImportJobData>): Promise<void> {
  const { importJobId, organizationId, entity, options } = job.data;

  console.log(
    `[ImportWorker] PROCESS START job.id=${job.id} importJobId=${importJobId} ` +
    `org=${organizationId} entity=${entity}`
  );

  // ── 1. Load import record ─────────────────────────────────────────────────
  const importJob = await prisma.importJob.findUnique({
    where: { id: importJobId },
  });

  if (!importJob) {
    throw new Error(
      `ImportJob ${importJobId} not found in DB. ` +
      `It may have been deleted before the worker picked it up.`
    );
  }

  if (importJob.organizationId !== organizationId) {
    throw new Error(
      `ImportJob ${importJobId} org mismatch: ` +
      `DB=${importJob.organizationId} job=${organizationId}`
    );
  }

  const currentStatus = importJob.status as string;

  // ── 2. Handle terminal states ─────────────────────────────────────────────
  if (currentStatus === "COMPLETED" || currentStatus === "PARTIAL") {
    console.warn(
      `[ImportWorker] importJobId=${importJobId} already ${currentStatus} — ` +
      `skipping (BullMQ job is a duplicate or retry after success)`
    );
    return; // Intentional no-op — marks BullMQ job as completed in Redis
  }

  if (currentStatus === "CANCELLED") {
    console.warn(
      `[ImportWorker] importJobId=${importJobId} is CANCELLED — skipping`
    );
    return; // Intentional no-op
  }

  // PROCESSING = previous worker started but stalled (lock expired, pod restarted)
  // MAPPING = DB update to QUEUED failed after successful enqueue (self-heal path)
  // QUEUED = normal pickup path
  // FAILED = retry after previous failure (BullMQ retry)
  if (!["QUEUED", "PROCESSING", "MAPPING", "PENDING", "FAILED"].includes(currentStatus)) {
    throw new Error(
      `ImportJob ${importJobId} has unexpected status=${currentStatus}. ` +
      `Cannot process from this state.`
    );
  }

  if (currentStatus === "PROCESSING") {
    console.warn(
      `[ImportWorker] importJobId=${importJobId} was in PROCESSING — ` +
      `previous worker stalled. Resetting and reprocessing.`
    );
  }

  if (currentStatus === "MAPPING") {
    console.warn(
      `[ImportWorker] importJobId=${importJobId} was in MAPPING when worker ` +
      `picked up the job — self-healing (DB QUEUED update must have failed).`
    );
  }

  // ── 3. Validate fieldMapping exists before doing any real work ────────────
  if (!importJob.fieldMapping) {
    throw new Error(
      `ImportJob ${importJobId} has no fieldMapping stored. ` +
      `The mapping route must persist rules before enqueueing. ` +
      `This is a bug in the mapping route.`
    );
  }

  console.log(
    `[ImportWorker] importJobId=${importJobId} fieldMapping present ` +
    `(${Array.isArray(importJob.fieldMapping) ? (importJob.fieldMapping as unknown[]).length : "?"} rules)`
  );

  // ── 4. Transition to PROCESSING ───────────────────────────────────────────
  await prisma.importJob.update({
    where: { id: importJobId },
    data: {
      status: "PROCESSING",
      startedAt: new Date(),
      // lastHeartbeatAt may not be present in Prisma's generated types in some
      // environments. Use a type assertion to bypass the strict type check
      // while still updating the DB column.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      lastHeartbeatAt: new Date(),
      bullmqJobId: job.id ?? `import_${importJobId}`,
      error: null,
    },
  });

  console.log(`[ImportWorker] importJobId=${importJobId} → PROCESSING`);
  await job.updateProgress(5);

  // ── 5. Start heartbeat ────────────────────────────────────────────────────
  const heartbeatInterval = setInterval(() => {
    prisma.importJob.update({
      where: { id: importJobId },
      // @ts-ignore
      data: { lastHeartbeatAt: new Date() },
    }).catch((err: unknown) => {
      console.warn(
        `[ImportWorker] Heartbeat update failed for importJobId=${importJobId}:`,
        (err as Error).message
      );
    });
  }, HEARTBEAT_INTERVAL_MS);

  // ── 6. Process (inside try so heartbeat is always cleared) ───────────────
  try {
    await runPipeline(job, importJob, importJobId, organizationId, entity, options);
  } finally {
    clearInterval(heartbeatInterval);
  }
}

// ---------------------------------------------------------------------------
// Pipeline execution (separated for clean finally/heartbeat semantics)
// ---------------------------------------------------------------------------

async function runPipeline(
  job: Job<ImportJobData>,
  importJob: Awaited<ReturnType<typeof prisma.importJob.findUnique>> & {},
  importJobId: string,
  organizationId: string,
  entity: string,
  options: ImportJobData["options"]
): Promise<void> {
  try {
    // ── Parse file ──────────────────────────────────────────────────────────
    const mimeType = importJob!.mimeType.toLowerCase();
    const isExcel =
      mimeType.includes("spreadsheet") ||
      mimeType.includes("excel") ||
      importJob!.filePath.endsWith(".xlsx") ||
      importJob!.filePath.endsWith(".xls");

    let rows: Record<string, string>[];
    let headers: string[];

    console.log(
      `[ImportWorker] importJobId=${importJobId} parsing ${isExcel ? "Excel" : "CSV"} ` +
      `at path=${importJob!.filePath}`
    );

    if (isExcel) {
      const parsed = await parseExcelFile(importJob!.filePath);
      rows = parsed.rows;
      headers = parsed.headers;
    } else {
      const parsed = await parseCSVFile(importJob!.filePath);
      rows = parsed.rows;
      headers = parsed.headers;
    }

    console.log(
      `[ImportWorker] importJobId=${importJobId} parsed ${rows.length} rows, ` +
      `${headers.length} headers`
    );

    if (rows.length === 0) {
      await prisma.importJob.update({
        where: { id: importJobId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          totalRows: 0,
          processedRows: 0,
          successRows: 0,
          failedRows: 0,
        },
      });
      console.log(
        `[ImportWorker] importJobId=${importJobId} — 0 data rows → COMPLETED`
      );
      return;
    }

    await prisma.importJob.update({
      where: { id: importJobId },
      data: { totalRows: rows.length, detectedColumns: headers },
    });

    await job.updateProgress(15);

    // ── Resolve mapping rules ───────────────────────────────────────────────
    const rules = resolveFieldMappingRules(importJob!);

    console.log(
      `[ImportWorker] importJobId=${importJobId} resolved ${rules.length} mapping rules`
    );

    if (rules.length === 0) {
      throw new Error(
        `ImportJob ${importJobId} has no field mapping rules after resolving. ` +
        `fieldMapping value: ${JSON.stringify(importJob!.fieldMapping)}. ` +
        `Ensure the mapping step saves at least one rule before enqueueing.`
      );
    }

    await job.updateProgress(20);

    // ── Run ETL pipeline ────────────────────────────────────────────────────
    const pipeline = new ETLPipeline();
    const pipelineEntity = mapImportEntity(entity || importJob!.entity);

    console.log(
      `[ImportWorker] importJobId=${importJobId} starting ETL entity=${pipelineEntity}`
    );

    await pipeline.run(rows, {
      importJobId,
      organizationId,
      entity: pipelineEntity,
      rules,
      chunkSize: 100,
      onProgress: async (progress, message) => {
        const scaled = Math.round(20 + (progress / 100) * 80);
        await job.updateProgress(Math.min(scaled, 99));
        if (message) await job.log(message);
      },
    });

    await job.updateProgress(100);
    console.log(
      `[ImportWorker] importJobId=${importJobId} ETL pipeline DONE`
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? (err.stack ?? "") : "";

    console.error(
      `[ImportWorker] importJobId=${importJobId} FAILED: ${message}\n${stack}`
    );

    // Always mark as FAILED in DB — never leave orphaned in PROCESSING
    try {
      await prisma.importJob.update({
        where: { id: importJobId },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          error: message.slice(0, 2000),
        },
      });
      console.log(`[ImportWorker] importJobId=${importJobId} → FAILED (DB updated)`);
    } catch (dbErr) {
      console.error(
        `[ImportWorker] CRITICAL: could not mark importJobId=${importJobId} as FAILED in DB:`,
        (dbErr as Error).message
      );
    }

    throw err; // Re-throw so BullMQ can retry / move to failed set
  }
}

// ---------------------------------------------------------------------------
// Resolve mapping rules from ImportJob.fieldMapping or saved default template
// ---------------------------------------------------------------------------

function resolveFieldMappingRules(importJob: {
  fieldMapping: unknown;
}): MappingRule[] {
  if (importJob.fieldMapping != null && Array.isArray(importJob.fieldMapping)) {
    const rules = importJob.fieldMapping as MappingRule[];
    if (rules.length > 0) return rules;
  }
  return [];
}

// ---------------------------------------------------------------------------
// ImportEntity enum → ETL pipeline entity string
// ---------------------------------------------------------------------------

function mapImportEntity(entity: string): PipelineEntity {
  const map: Record<string, PipelineEntity> = {
    CUSTOMERS: "customer",
    VENDORS: "customer",
    INVOICES: "invoice",
    PRODUCTS: "product",
    EMPLOYEES: "employee",
    CA_USERS: "ca_user",
    FIRMS: "firm",
    ASSIGNMENTS: "assignment",
    MASTER_IMPORT: "master_import",
  };
  return map[entity.toUpperCase()] ?? "customer";
}
