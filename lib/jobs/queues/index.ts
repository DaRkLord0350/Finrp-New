// ============================================================
// FinRP — BullMQ Queue Registry
// Three queues: import, sync, webhook.
// Each queue gets its own dedicated Redis connection.
// ============================================================

import { Queue, QueueEvents } from "bullmq";
import { getRedisConnection } from "@/lib/redis";

// ---------------------------------------------------------------------------
// Queue names
// ---------------------------------------------------------------------------
export const QUEUE_NAMES = {
  // IMPORT: "finrp:import",
  // SYNC: "finrp:sync",
  // WEBHOOK: "finrp:webhook",
  IMPORT: "finrp-import",
  SYNC: "finrp-sync",
  WEBHOOK: "finrp-webhook",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ---------------------------------------------------------------------------
// Default job options
// ---------------------------------------------------------------------------
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 2000, // 2s, 4s, 8s
  },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 500 },
};

// ---------------------------------------------------------------------------
// Job data interfaces (typed payloads per queue)
// ---------------------------------------------------------------------------

export interface ImportJobData {
  importJobId: string;
  organizationId: string;
  entity: string;
  options: {
    skipDuplicates: boolean;
    updateExisting: boolean;
    dryRun: boolean;
  };
}

export interface SyncJobData {
  syncJobId: string;
  organizationId: string;
  integrationId: string;
  connectorType: string;
  entity?: string;
  isIncremental: boolean;
  cursor?: string;
}

export interface WebhookJobData {
  webhookEventId: string;
  organizationId: string;
  integrationId: string;
  source: string;
  eventType: string;
}

// ---------------------------------------------------------------------------
// Queue singletons — lazy initialized
// ---------------------------------------------------------------------------
let importQueue: Queue<ImportJobData> | null = null;
let syncQueue: Queue<SyncJobData> | null = null;
let webhookQueue: Queue<WebhookJobData> | null = null;

export function getImportQueue(): Queue<ImportJobData> {
  if (!importQueue) {
    importQueue = new Queue<ImportJobData>(QUEUE_NAMES.IMPORT, {
      connection: getRedisConnection("queue"),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }
  return importQueue;
}

export function getSyncQueue(): Queue<SyncJobData> {
  if (!syncQueue) {
    syncQueue = new Queue<SyncJobData>(QUEUE_NAMES.SYNC, {
      connection: getRedisConnection("queue"),
      defaultJobOptions: {
        ...DEFAULT_JOB_OPTIONS,
        attempts: 5, // syncs get more retries
        backoff: { type: "exponential", delay: 5000 },
      },
    });
  }
  return syncQueue;
}

export function getWebhookQueue(): Queue<WebhookJobData> {
  if (!webhookQueue) {
    webhookQueue = new Queue<WebhookJobData>(QUEUE_NAMES.WEBHOOK, {
      connection: getRedisConnection("queue"),
      defaultJobOptions: {
        ...DEFAULT_JOB_OPTIONS,
        attempts: 5,
        backoff: { type: "exponential", delay: 1000 },
      },
    });
  }
  return webhookQueue;
}

// ---------------------------------------------------------------------------
// Job enqueue helpers
// ---------------------------------------------------------------------------

export async function enqueueImport(data: ImportJobData): Promise<string> {
  console.log("[QUEUE] enqueue start", data.importJobId);

  const q = getImportQueue();

  // Log queue depth — lets us detect Redis connectivity issues or backlogs.
  const counts = await q.getJobCounts("waiting", "active", "completed", "failed");
  console.log("[QUEUE COUNTS]", counts);

  const bullmqJobId = `import_${data.importJobId}`;

  const job = await q.add("process-import", data, {
    jobId: bullmqJobId, // deterministic — safe to call twice without duplicating
  });

  // BullMQ returns job.id === undefined when the job already exists in the queue
  // (deduplication). Fall back to the constructed ID we intended to use, NOT the
  // raw importJobId — the BullMQ key prefix matters for cross-referencing in Redis.
  const resolvedId = job.id ?? bullmqJobId;

  if (!job.id) {
    console.warn(
      `[QUEUE] Job already exists in queue for importJobId=${data.importJobId}. ` +
      `Using existing bullmqJobId=${resolvedId}`
    );
  }

  console.log("[QUEUE] enqueue success", {
    importJobId: data.importJobId,
    bullmqJobId: resolvedId,
  });

  return resolvedId;
}

export async function enqueueSync(data: SyncJobData, delayMs = 0): Promise<string> {
  const q = getSyncQueue();
  const job = await q.add("run-sync", data, {
    jobId: `sync_${data.syncJobId}`,
    delay: delayMs,
  });
  return job.id ?? data.syncJobId;
}

export async function enqueueWebhook(data: WebhookJobData): Promise<string> {
  const q = getWebhookQueue();
  const job = await q.add("process-webhook", data);
  return job.id!;
}

// ---------------------------------------------------------------------------
// Schedule repeatable sync (cron)
// ---------------------------------------------------------------------------
export async function scheduleRepeatingSync(
  integrationId: string,
  organizationId: string,
  connectorType: string,
  intervalMinutes: number
): Promise<void> {
  const q = getSyncQueue();
  const cronJobId = `cron_sync:${integrationId}`;

  // Remove old repeat if it exists
  await q.removeRepeatable("run-sync", {
    jobId: cronJobId,
    every: intervalMinutes * 60 * 1000,
  });

  await q.add(
    "run-sync",
    {
      syncJobId: `scheduled-${integrationId}`,
      organizationId,
      integrationId,
      connectorType,
      isIncremental: true,
    },
    {
      jobId: cronJobId,
      repeat: { every: intervalMinutes * 60 * 1000 },
    }
  );
}

// ---------------------------------------------------------------------------
// Queue Events (for monitoring / SSE progress)
// ---------------------------------------------------------------------------
let importQueueEvents: QueueEvents | null = null;

export function getImportQueueEvents(): QueueEvents {
  if (!importQueueEvents) {
    importQueueEvents = new QueueEvents(QUEUE_NAMES.IMPORT, {
      connection: getRedisConnection("events"),
    });
  }
  return importQueueEvents;
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
export async function getQueueHealth(): Promise<Record<string, {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}>> {
  const [iq, sq, wq] = await Promise.all([
    getImportQueue(),
    getSyncQueue(),
    getWebhookQueue(),
  ]);

  const [importCounts, syncCounts, webhookCounts] = await Promise.all([
    iq.getJobCounts("waiting", "active", "completed", "failed"),
    sq.getJobCounts("waiting", "active", "completed", "failed"),
    wq.getJobCounts("waiting", "active", "completed", "failed"),
  ]);

  return {
    import: importCounts as { waiting: number; active: number; completed: number; failed: number },
    sync: syncCounts as { waiting: number; active: number; completed: number; failed: number },
    webhook: webhookCounts as { waiting: number; active: number; completed: number; failed: number },
  };
}
