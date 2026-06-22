// ============================================================
// FinRP — CSV/Excel Import processor
// Pure end-to-end processing of an ImportJob record (no queue runtime).
// Ported from the former BullMQ import worker. Invoked by the csv-import
// Inngest function; `onProgress(0..100)` feeds the BackgroundJob ledger
// and refreshes lastHeartbeatAt for the stuck-job checker.
//
// Guarantees preserved:
//   • Every path ends in COMPLETED, PARTIAL, FAILED, or CANCELLED
//   • Terminal states are skipped (idempotent on retry / duplicate)
//   • DB always reflects true state — never orphaned in PROCESSING
// ============================================================

import { prisma } from "@/lib/prisma";
import { ETLPipeline, type PipelineEntity } from "@/lib/etl/pipeline";
import { parseCSVFile } from "@/lib/connectors/csv/parser";
import { parseExcelFile } from "@/lib/connectors/excel/parser";
import type { MappingRule } from "@/lib/connectors/base/types";
import type { ImportJobData } from "@/lib/jobs/queues";

type ProgressFn = (progress: number, message?: string) => void | Promise<void>;

export interface ImportResult {
  importJobId: string;
  status: "COMPLETED" | "SKIPPED";
  totalRows?: number;
}

export async function processImport(
  data: ImportJobData,
  onProgress: ProgressFn = () => {}
): Promise<ImportResult> {
  const { importJobId, organizationId, entity } = data;

  // ── 1. Load import record ───────────────────────────────────────────────
  const importJob = await prisma.importJob.findUnique({ where: { id: importJobId } });
  if (!importJob) {
    throw new Error(
      `ImportJob ${importJobId} not found in DB. It may have been deleted before processing.`
    );
  }
  if (importJob.organizationId !== organizationId) {
    throw new Error(
      `ImportJob ${importJobId} org mismatch: DB=${importJob.organizationId} job=${organizationId}`
    );
  }

  const currentStatus = importJob.status as string;

  // ── 2. Terminal states → idempotent skip ────────────────────────────────
  if (currentStatus === "COMPLETED" || currentStatus === "PARTIAL") {
    console.warn(`[import] ${importJobId} already ${currentStatus} — skipping (duplicate/retry)`);
    return { importJobId, status: "SKIPPED" };
  }
  if (currentStatus === "CANCELLED") {
    console.warn(`[import] ${importJobId} is CANCELLED — skipping`);
    return { importJobId, status: "SKIPPED" };
  }
  if (!["QUEUED", "PROCESSING", "MAPPING", "PENDING", "FAILED"].includes(currentStatus)) {
    throw new Error(`ImportJob ${importJobId} has unexpected status=${currentStatus}.`);
  }

  // ── 3. Validate fieldMapping exists ─────────────────────────────────────
  if (!importJob.fieldMapping) {
    throw new Error(
      `ImportJob ${importJobId} has no fieldMapping stored. The mapping route must persist rules before dispatch.`
    );
  }

  // ── 4. Transition to PROCESSING ─────────────────────────────────────────
  await prisma.importJob.update({
    where: { id: importJobId },
    data: { status: "PROCESSING", startedAt: new Date(), lastHeartbeatAt: new Date(), error: null },
  });
  await onProgress(5);

  try {
    // ── Parse file ────────────────────────────────────────────────────────
    const mimeType = importJob.mimeType.toLowerCase();
    const isExcel =
      mimeType.includes("spreadsheet") ||
      mimeType.includes("excel") ||
      importJob.filePath.endsWith(".xlsx") ||
      importJob.filePath.endsWith(".xls");

    const parsed = isExcel
      ? await parseExcelFile(importJob.filePath)
      : await parseCSVFile(importJob.filePath);
    const rows = parsed.rows;
    const headers = parsed.headers;

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
      await onProgress(100);
      return { importJobId, status: "COMPLETED", totalRows: 0 };
    }

    await prisma.importJob.update({
      where: { id: importJobId },
      data: { totalRows: rows.length, detectedColumns: headers, lastHeartbeatAt: new Date() },
    });
    await onProgress(15);

    // ── Resolve mapping rules ─────────────────────────────────────────────
    const rules = resolveFieldMappingRules(importJob);
    if (rules.length === 0) {
      throw new Error(
        `ImportJob ${importJobId} has no field mapping rules after resolving. ` +
          `fieldMapping: ${JSON.stringify(importJob.fieldMapping)}.`
      );
    }
    await onProgress(20);

    // ── Run ETL pipeline ──────────────────────────────────────────────────
    const pipeline = new ETLPipeline();
    const pipelineEntity = mapImportEntity(entity || importJob.entity);

    await pipeline.run(rows, {
      importJobId,
      organizationId,
      entity: pipelineEntity,
      rules,
      chunkSize: 100,
      onProgress: async (progress, message) => {
        const scaled = Math.min(Math.round(20 + (progress / 100) * 80), 99);
        await prisma.importJob
          .update({ where: { id: importJobId }, data: { lastHeartbeatAt: new Date() } })
          .catch(() => {});
        await onProgress(scaled, message);
      },
    });

    await onProgress(100);
    return { importJobId, status: "COMPLETED", totalRows: rows.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Always mark FAILED — never leave orphaned in PROCESSING.
    await prisma.importJob
      .update({
        where: { id: importJobId },
        data: { status: "FAILED", failedAt: new Date(), error: message.slice(0, 2000) },
      })
      .catch((dbErr) =>
        console.error(`[import] CRITICAL: could not mark ${importJobId} FAILED:`, (dbErr as Error).message)
      );
    throw err; // Re-throw so Inngest retries
  }
}

// ---------------------------------------------------------------------------
function resolveFieldMappingRules(importJob: { fieldMapping: unknown }): MappingRule[] {
  if (importJob.fieldMapping != null && Array.isArray(importJob.fieldMapping)) {
    const rules = importJob.fieldMapping as MappingRule[];
    if (rules.length > 0) return rules;
  }
  return [];
}

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
