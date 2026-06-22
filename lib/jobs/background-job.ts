// ============================================================
// FinRP — BackgroundJob ledger helper
//
// A thin, best-effort wrapper over the `background_jobs` table that
// Inngest functions use to expose a unified progress/monitor surface
// to the frontend. Per-domain tables (ImportJob, SyncJob, …) remain
// the detailed source of truth; this is the cross-cutting registry.
//
// Every write is wrapped in try/catch: a ledger failure must NEVER
// fail (or change the outcome of) the underlying job.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type BgStatus = "QUEUED" | "RUNNING" | "RETRYING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface StartBackgroundJobInput {
  /** Dotted job type, e.g. "csv.import", "bank.sync", "email.send". */
  type: string;
  organizationId?: string | null;
  /** Owning domain record id (importJobId, syncJobId, …). */
  referenceId?: string | null;
  /** Stable key so retries / duplicate dispatches collapse onto one row. */
  idempotencyKey?: string | null;
  eventName?: string;
  eventId?: string;
  runId?: string;
  attempt?: number;
  metadata?: Prisma.InputJsonValue;
}

export interface BackgroundJobHandle {
  id: string | null;
  setProgress(progress: number): Promise<void>;
  retrying(attempt: number): Promise<void>;
  complete(result?: unknown): Promise<void>;
  fail(error: unknown): Promise<void>;
}

const NOOP_HANDLE: BackgroundJobHandle = {
  id: null,
  async setProgress() {},
  async retrying() {},
  async complete() {},
  async fail() {},
};

function clampProgress(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Mark a job RUNNING (creating the row on first dispatch, reusing it on
 * retry when an idempotencyKey is supplied) and return a handle whose
 * methods advance the ledger. All methods are safe no-ops if the initial
 * write failed.
 */
export async function startBackgroundJob(input: StartBackgroundJobInput): Promise<BackgroundJobHandle> {
  const base = {
    type: input.type,
    organizationId: input.organizationId ?? null,
    referenceId: input.referenceId ?? null,
    eventName: input.eventName ?? null,
    eventId: input.eventId ?? null,
    runId: input.runId ?? null,
    metadata: input.metadata,
  };

  let id: string | null = null;
  try {
    if (input.idempotencyKey) {
      const row = await prisma.backgroundJob.upsert({
        where: { idempotencyKey: input.idempotencyKey },
        create: {
          ...base,
          idempotencyKey: input.idempotencyKey,
          status: "RUNNING",
          attempts: input.attempt ?? 1,
          startedAt: new Date(),
        },
        update: {
          status: "RUNNING",
          attempts: input.attempt ?? { increment: 1 },
          startedAt: new Date(),
          error: null,
          runId: base.runId,
          eventId: base.eventId,
        },
        select: { id: true },
      });
      id = row.id;
    } else {
      const row = await prisma.backgroundJob.create({
        data: { ...base, status: "RUNNING", attempts: input.attempt ?? 1, startedAt: new Date() },
        select: { id: true },
      });
      id = row.id;
    }
  } catch (err) {
    console.warn(`[background-job] start failed for type=${input.type}:`, (err as Error).message);
    return NOOP_HANDLE;
  }

  const update = async (data: Prisma.BackgroundJobUpdateInput) => {
    if (!id) return;
    try {
      await prisma.backgroundJob.update({ where: { id }, data });
    } catch (err) {
      console.warn(`[background-job] update failed for id=${id}:`, (err as Error).message);
    }
  };

  return {
    id,
    setProgress: (progress) => update({ progress: clampProgress(progress) }),
    retrying: (attempt) => update({ status: "RETRYING" satisfies BgStatus, attempts: attempt }),
    complete: (result) =>
      update({
        status: "COMPLETED" satisfies BgStatus,
        progress: 100,
        completedAt: new Date(),
        result: (result ?? undefined) as Prisma.InputJsonValue | undefined,
      }),
    fail: (error) =>
      update({
        status: "FAILED" satisfies BgStatus,
        completedAt: new Date(),
        error: (error instanceof Error ? error.message : String(error)).slice(0, 2000),
      }),
  };
}

/** Lightweight counts for the health/monitoring endpoints. */
export async function getBackgroundJobHealth(): Promise<Record<BgStatus, number>> {
  const empty: Record<BgStatus, number> = {
    QUEUED: 0,
    RUNNING: 0,
    RETRYING: 0,
    COMPLETED: 0,
    FAILED: 0,
    CANCELLED: 0,
  };
  try {
    const grouped = await prisma.backgroundJob.groupBy({ by: ["status"], _count: { _all: true } });
    for (const g of grouped) empty[g.status as BgStatus] = g._count._all;
  } catch {
    // best-effort
  }
  return empty;
}
