// ============================================================
// FinRP — Sync BullMQ Worker
// Processes SyncJob records: instantiates the correct connector
// via the factory, runs entity sync, updates SyncJob progress.
// Writes per-entity SyncLog records for audit/monitoring.
// ============================================================

import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "@/lib/redis";
import { QUEUE_NAMES, type SyncJobData } from "@/lib/jobs/queues";
import { prisma } from "@/lib/prisma";
import { createConnector } from "@/lib/connectors/factory";
import type { SyncStats, SyncCursor } from "@/lib/connectors/base/types";

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

export function createSyncWorker() {
  const worker = new Worker<SyncJobData>(
    QUEUE_NAMES.SYNC,
    async (job: Job<SyncJobData>) => {
      return processSyncJob(job);
    },
    {
      connection: getRedisConnection("worker"),
      concurrency: 5,
      limiter: {
        max: 20,
        duration: 60_000,
      },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[SyncWorker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[SyncWorker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[SyncWorker] Worker error:", err);
  });

  return worker;
}

// ---------------------------------------------------------------------------
// Core processor
// ---------------------------------------------------------------------------

async function processSyncJob(job: Job<SyncJobData>): Promise<void> {
  const { syncJobId, organizationId, integrationId, entity, isIncremental, cursor } = job.data;

  // ── 1. Create or find SyncJob record ──
  let syncJob = await prisma.syncJob.findFirst({
    where: { id: syncJobId, organizationId },
  });

  if (!syncJob) {
    // Scheduled jobs create their own SyncJob record
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });
    if (!integration || integration.organizationId !== organizationId) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    syncJob = await prisma.syncJob.create({
      data: {
        organizationId,
        integrationId,
        type: isIncremental ? "INCREMENTAL" : "FULL",
        entity: entity ?? "all",
        status: "RUNNING",
        startedAt: new Date(),
        bullmqJobId: job.id,
      },
    });
  } else {
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: { status: "RUNNING", startedAt: new Date(), bullmqJobId: job.id },
    });
  }

  await job.updateProgress(5);

  try {
    // ── 2. Instantiate connector ──
    const connector = await createConnector(integrationId, organizationId);
    await job.updateProgress(10);

    // ── 3. Resolve cursor for incremental sync ──
    const syncCursor: SyncCursor | undefined = isIncremental && cursor
      ? { lastModifiedAt: cursor }
      : isIncremental
      ? await getLastSyncCursor(integrationId, organizationId)
      : undefined;

    await job.updateProgress(15);

    // ── 4. Run entity syncs ──
    const entitiesToSync = resolveEntities(entity ?? "all");
    const totalEntities = entitiesToSync.length;

    const aggregateStats: SyncStats = {
      created: 0, updated: 0, skipped: 0, failed: 0, merged: 0,
    };

    for (let i = 0; i < entitiesToSync.length; i++) {
      const entityName = entitiesToSync[i];

      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: { entity: entityName },
      });

      const entityStartMs = Date.now();
      let entityStats: SyncStats = { created: 0, updated: 0, skipped: 0, failed: 0, merged: 0 };

      try {
        entityStats = await connector.sync(entityName, syncCursor);

        await writeSyncLog({
          syncJobId: syncJob.id,
          organizationId,
          integrationId,
          entity: entityName,
          action: "CREATE",
          status: "SUCCESS",
          durationMs: Date.now() - entityStartMs,
          stats: entityStats,
        });

        mergeStats(aggregateStats, entityStats);
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : String(err);

        await writeSyncLog({
          syncJobId: syncJob.id,
          organizationId,
          integrationId,
          entity: entityName,
          action: "ERROR",
          status: "FAILED",
          durationMs: Date.now() - entityStartMs,
          error: errMessage,
        });

        // Individual entity failure should not abort other entities
        console.error(`[SyncWorker] Entity "${entityName}" sync failed:`, errMessage);
      }

      const progress = 15 + Math.round(((i + 1) / totalEntities) * 80);
      await job.updateProgress(progress);
    }

    // ── 5. Mark integration as synced ──
    const newCursor = aggregateStats.nextCursor ?? new Date().toISOString();

    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: aggregateStats.failed > 0 ? "FAILED" : "COMPLETED",
      },
    });

    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status:
          aggregateStats.failed > 0 && aggregateStats.created + aggregateStats.updated === 0
            ? "FAILED"
            : "COMPLETED",
        completedAt: new Date(),
        totalRecords: aggregateStats.created + aggregateStats.updated + aggregateStats.skipped + aggregateStats.failed,
        processedRecords: aggregateStats.created + aggregateStats.updated + aggregateStats.skipped,
        successRecords: aggregateStats.created + aggregateStats.updated,
        failedRecords: aggregateStats.failed,
        lastCursor: newCursor,
      },
    });

    await job.updateProgress(100);

  } catch (err) {
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveEntities(entity: string): string[] {
  if (entity === "all") return ["customers", "invoices", "products"];
  return [entity];
}

async function getLastSyncCursor(
  integrationId: string,
  organizationId: string
): Promise<SyncCursor | undefined> {
  // Get cursor from the last successfully completed sync job
  const lastJob = await prisma.syncJob.findFirst({
    where: {
      integrationId,
      organizationId,
      status: "COMPLETED",
      lastCursor: { not: null },
    },
    orderBy: { completedAt: "desc" },
    select: { lastCursor: true },
  });

  if (!lastJob?.lastCursor) return undefined;

  return { lastModifiedAt: lastJob.lastCursor };
}

async function writeSyncLog(params: {
  syncJobId: string;
  organizationId: string;
  integrationId: string;
  entity: string;
  action: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED" | "WARNING";
  durationMs: number;
  stats?: SyncStats;
  error?: string;
}): Promise<void> {
  try {
    await prisma.syncLog.create({
      data: {
        syncJobId: params.syncJobId,
        entityType: params.entity,
        action: params.action as "CREATE" | "UPDATE" | "SKIP" | "DELETE" | "MERGE" | "ERROR",
        status: params.status,
        durationMs: params.durationMs,
        data: params.stats
          ? {
              created: params.stats.created,
              updated: params.stats.updated,
              skipped: params.stats.skipped,
              failed: params.stats.failed,
            }
          : undefined,
        error: params.error ?? null,
      },
    });
  } catch (err) {
    console.error("[SyncWorker] Failed to write sync log:", err);
  }
}

function mergeStats(target: SyncStats, source: SyncStats): void {
  target.created += source.created;
  target.updated += source.updated;
  target.skipped += source.skipped;
  target.failed += source.failed;
  target.merged += source.merged;
  if (source.nextCursor) target.nextCursor = source.nextCursor;
}
