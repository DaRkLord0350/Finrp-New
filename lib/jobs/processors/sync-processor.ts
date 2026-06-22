// ============================================================
// FinRP — Integration Sync processor
// Instantiates the correct connector via the factory, runs entity
// syncs, updates SyncJob progress, writes per-entity SyncLog records.
// Ported from the former BullMQ sync worker; invoked by the
// integration-sync Inngest function. `attempt` lets resumable cursor
// logic mirror the old attemptsMade behaviour.
// ============================================================

import { prisma } from "@/lib/prisma";
import { createConnector } from "@/lib/connectors/factory";
import type { SyncStats, SyncCursor } from "@/lib/connectors/base/types";
import type { SyncJobData } from "@/lib/jobs/queues";

type ProgressFn = (progress: number) => void | Promise<void>;

export async function processSync(
  data: SyncJobData,
  onProgress: ProgressFn = () => {}
): Promise<void> {
  const { syncJobId, organizationId, integrationId, entity, isIncremental, cursor } = data;

  // ── 1. Create or find SyncJob record ──
  let syncJob = await prisma.syncJob.findFirst({ where: { id: syncJobId, organizationId } });

  if (!syncJob) {
    const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
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
      },
    });
  } else {
    if (syncJob.status === "COMPLETED") {
      // Idempotent: a duplicate dispatch for an already-finished sync.
      return;
    }
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: { status: "RUNNING", startedAt: new Date() },
    });
  }

  await onProgress(5);

  try {
    // ── 2. Instantiate connector ──
    const connector = await createConnector(integrationId, organizationId);
    await onProgress(10);

    // ── 3. Resolve cursor for incremental sync ──
    const syncCursor: SyncCursor | undefined =
      isIncremental && cursor
        ? { lastModifiedAt: cursor }
        : isIncremental
          ? await getLastSyncCursor(integrationId, organizationId)
          : undefined;

    await onProgress(15);

    // ── 4. Run entity syncs ──
    const entitiesToSync = resolveEntities(entity ?? "all");
    const totalEntities = entitiesToSync.length;

    const aggregateStats: SyncStats = { created: 0, updated: 0, skipped: 0, failed: 0, merged: 0 };

    for (let i = 0; i < entitiesToSync.length; i++) {
      const entityName = entitiesToSync[i];

      await prisma.syncJob.update({ where: { id: syncJob.id }, data: { entity: entityName } });

      const entityStartMs = Date.now();
      let entityStats: SyncStats = { created: 0, updated: 0, skipped: 0, failed: 0, merged: 0 };

      try {
        entityStats = await connector.sync(entityName, syncCursor);
        await writeSyncLog({
          syncJobId: syncJob.id,
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
          entity: entityName,
          action: "ERROR",
          status: "FAILED",
          durationMs: Date.now() - entityStartMs,
          error: errMessage,
        });
        console.error(`[sync] Entity "${entityName}" sync failed:`, errMessage);
      }

      await onProgress(15 + Math.round(((i + 1) / totalEntities) * 80));
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
        totalRecords:
          aggregateStats.created + aggregateStats.updated + aggregateStats.skipped + aggregateStats.failed,
        processedRecords: aggregateStats.created + aggregateStats.updated + aggregateStats.skipped,
        successRecords: aggregateStats.created + aggregateStats.updated,
        failedRecords: aggregateStats.failed,
        lastCursor: newCursor,
      },
    });

    await onProgress(100);
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
function resolveEntities(entity: string): string[] {
  if (entity === "all") return ["customers", "invoices", "products"];
  return [entity];
}

async function getLastSyncCursor(
  integrationId: string,
  organizationId: string
): Promise<SyncCursor | undefined> {
  const lastJob = await prisma.syncJob.findFirst({
    where: { integrationId, organizationId, status: "COMPLETED", lastCursor: { not: null } },
    orderBy: { completedAt: "desc" },
    select: { lastCursor: true },
  });
  if (!lastJob?.lastCursor) return undefined;
  return { lastModifiedAt: lastJob.lastCursor };
}

async function writeSyncLog(params: {
  syncJobId: string;
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
    console.error("[sync] Failed to write sync log:", err);
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
