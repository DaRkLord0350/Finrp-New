// ============================================================
// FinRP — Stuck Import Job Recovery
// Runs every 60 s in the worker process.
// Finds jobs that have been stuck in QUEUED or PROCESSING
// past their allowed duration and fails or retries them.
//
// Thresholds:
//   QUEUED    → no worker pickup for >5 min  → re-enqueue or FAIL
//   PROCESSING → heartbeat stale for >5 min  → FAIL (worker crashed)
//   MAPPING    → no queue transition for >10 min → log warning (user action needed)
// ============================================================

import { prisma } from "@/lib/prisma";
import { enqueueImport } from "@/lib/jobs/queues";
import { getImportQueue } from "@/lib/jobs/queues";

const QUEUED_STUCK_MS       = 5  * 60 * 1000;  // 5 min
const PROCESSING_STUCK_MS   = 5  * 60 * 1000;  // 5 min without heartbeat
const MAPPING_WARNING_MS    = 10 * 60 * 1000;  // 10 min (user action needed)
const MAX_AUTO_RETRIES      = 3;

let checkerRunning = false;

export async function runStuckJobChecker(): Promise<void> {
  if (checkerRunning) return; // Prevent overlapping runs
  checkerRunning = true;

  try {
    await Promise.all([
      recoverStuckQueued(),
      recoverStuckProcessing(),
      logStuckMapping(),
    ]);
  } catch (err) {
    console.error("[StuckChecker] Unhandled error:", (err as Error).message);
  } finally {
    checkerRunning = false;
  }
}

// ---------------------------------------------------------------------------
// Recover QUEUED jobs that haven't been picked up
// ---------------------------------------------------------------------------

async function recoverStuckQueued(): Promise<void> {
  const cutoff = new Date(Date.now() - QUEUED_STUCK_MS);

  // A QUEUED job is stuck if it's been in that state longer than the threshold.
  // We use updatedAt as the proxy for when it entered QUEUED (queuedAt may be null
  // for pre-migration records).
  const stuck = await (prisma as any).importJob.findMany({
    where: {
      status: "Pending",
      updatedAt: { lt: cutoff },
    },
    select: {
      id: true,
      organizationId: true,
      entity: true,
      bullmqJobId: true,
      retryCount: true,
      updatedAt: true,
    },
    take: 50,
  });

  if (stuck.length === 0) return;

  console.log(`[StuckChecker] Found ${stuck.length} stuck QUEUED job(s)`);

  for (const job of stuck) {
    const stuckMs = Date.now() - new Date(job.updatedAt).getTime();

    console.warn(
      `[StuckChecker] QUEUED stuck: importJobId=${job.id} ` +
      `retryCount=${job.retryCount} stuckFor=${Math.round(stuckMs / 1000)}s ` +
      `bullmqJobId=${job.bullmqJobId ?? "none"}`
    );

    if (job.retryCount >= MAX_AUTO_RETRIES) {
      console.error(
        `[StuckChecker] Max retries (${MAX_AUTO_RETRIES}) reached for importJobId=${job.id} → FAILED`
      );
      await (prisma as any).importJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          error:
            `Job stuck in QUEUED for ${Math.round(stuckMs / 60_000)} min. ` +
            `Max retries (${MAX_AUTO_RETRIES}) exceeded. ` +
            `Check worker logs and Redis connectivity.`,
        },
      });
      continue;
    }

    // Check if BullMQ job actually exists in Redis
    let jobExistsInRedis = false;
    if (job.bullmqJobId) {
      try {
        const q = getImportQueue();
        const bJob = await q.getJob(job.bullmqJobId);
        jobExistsInRedis = bJob != null;
        if (jobExistsInRedis) {
          const state = await bJob!.getState();
          console.log(
            `[StuckChecker] importJobId=${job.id} BullMQ state=${state} — ` +
            `job exists in Redis, worker may just be slow`
          );
          if (state === "active" || state === "waiting") continue; // Worker is working
        }
      } catch {
        // Redis unavailable — can't check; skip re-enqueue attempt
        console.warn(`[StuckChecker] Cannot check Redis for importJobId=${job.id}`);
        continue;
      }
    }

    // Re-enqueue
    try {
      console.log(`[StuckChecker] Re-enqueueing importJobId=${job.id}`);

      // Remove old job first if it's in a failed/stuck state in Redis
      if (job.bullmqJobId) {
        try {
          const q = getImportQueue();
          const bJob = await q.getJob(job.bullmqJobId);
          if (bJob) await bJob.remove();
        } catch { /* best-effort */ }
      }

      const newBullmqJobId = await enqueueImport({
        importJobId: job.id,
        organizationId: job.organizationId,
        entity: job.entity,
        options: { skipDuplicates: true, updateExisting: true, dryRun: false },
      });

      await (prisma as any).importJob.update({
        where: { id: job.id },
        data: {
          bullmqJobId: newBullmqJobId,
          queuedAt: new Date(),
          retryCount: { increment: 1 },
          error: null,
        },
      });

      console.log(
        `[StuckChecker] Re-enqueued importJobId=${job.id} → newBullmqJobId=${newBullmqJobId}`
      );
    } catch (reEnqueueErr) {
      console.error(
        `[StuckChecker] Failed to re-enqueue importJobId=${job.id}:`,
        (reEnqueueErr as Error).message
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Recover PROCESSING jobs with stale heartbeat (worker crashed)
// ---------------------------------------------------------------------------

async function recoverStuckProcessing(): Promise<void> {
  const cutoff = new Date(Date.now() - PROCESSING_STUCK_MS);

  // A PROCESSING job is stuck if:
  //   - lastHeartbeatAt is stale OR null AND startedAt is old
  const stuck = await (prisma as any).importJob.findMany({
    where: {
      status: "PROCESSING",
      OR: [
        // Heartbeat exists but is stale
        { lastHeartbeatAt: { lt: cutoff } },
        // No heartbeat at all (pre-migration record) and started > threshold ago
        {
          AND: [
            { lastHeartbeatAt: null },
            { startedAt: { lt: cutoff } },
          ],
        },
      ],
    },
    select: {
      id: true,
      organizationId: true,
      entity: true,
      bullmqJobId: true,
      retryCount: true,
      startedAt: true,
      lastHeartbeatAt: true,
    },
    take: 50,
  });

  if (stuck.length === 0) return;

  console.log(`[StuckChecker] Found ${stuck.length} stuck PROCESSING job(s)`);

  for (const job of stuck) {
    const lastHeartbeat = job.lastHeartbeatAt
      ? new Date(job.lastHeartbeatAt).getTime()
      : (job.startedAt ? new Date(job.startedAt).getTime() : Date.now());
    const staleSec = Math.round((Date.now() - lastHeartbeat) / 1000);

    console.error(
      `[StuckChecker] PROCESSING stuck: importJobId=${job.id} ` +
      `heartbeat stale for ${staleSec}s retryCount=${job.retryCount}`
    );

    // Check if BullMQ job is actually active in Redis
    if (job.bullmqJobId) {
      try {
        const q = getImportQueue();
        const bJob = await q.getJob(job.bullmqJobId);
        if (bJob) {
          const state = await bJob.getState();
          if (state === "active") {
            console.log(
              `[StuckChecker] importJobId=${job.id} BullMQ still active — ` +
              `heartbeat may be a false positive, skipping`
            );
            continue;
          }
        }
      } catch { /* Redis unavailable */ }
    }

    await (prisma as any).importJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        error:
          `Worker heartbeat missing for ${staleSec}s. ` +
          `The worker process likely crashed mid-import. ` +
          `Please retry the import.`,
      },
    });

    console.log(`[StuckChecker] importJobId=${job.id} → FAILED (stale heartbeat)`);
  }
}

// ---------------------------------------------------------------------------
// Log MAPPING jobs stuck without user action (informational only)
// ---------------------------------------------------------------------------

async function logStuckMapping(): Promise<void> {
  const cutoff = new Date(Date.now() - MAPPING_WARNING_MS);

  const count = await (prisma as any).importJob.count({
    where: {
      status: "MAPPING",
      updatedAt: { lt: cutoff },
    },
  });

  if (count > 0) {
    console.warn(
      `[StuckChecker] ${count} import(s) stuck in MAPPING >10 min. ` +
      `These require user action (re-submit mapping) or were abandoned.`
    );
  }
}

// ---------------------------------------------------------------------------
// Start recurring checker
// ---------------------------------------------------------------------------

export function startStuckJobChecker(intervalMs = 60_000): NodeJS.Timeout {
  console.log(
    `[StuckChecker] Starting — checking every ${intervalMs / 1000}s`
  );

  // Run once immediately, then on the interval
  void runStuckJobChecker();

  return setInterval(() => {
    void runStuckJobChecker();
  }, intervalMs);
}
