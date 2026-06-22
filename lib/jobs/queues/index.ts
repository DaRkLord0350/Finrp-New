// ============================================================
// FinRP — Async dispatch helpers (Inngest-backed)
//
// Historically this module created BullMQ queues. It now sends typed
// Inngest events. The public surface (enqueueImport / enqueueSync /
// enqueueWebhook + the *JobData interfaces) is unchanged so every
// caller keeps working without modification — the worker logic lives
// in inngest/functions/* and Inngest owns retries + scheduling.
// ============================================================

import { inngest } from "@/inngest/client";
import { EVENTS } from "@/inngest/events";
import { getBackgroundJobHealth } from "@/lib/jobs/background-job";

// ---------------------------------------------------------------------------
// Stable labels — used as BackgroundJob.type / TaxJobRun.queue values and as
// human-facing identifiers. (No longer Redis queue names.)
// ---------------------------------------------------------------------------
export const QUEUE_NAMES = {
  IMPORT: "finrp-import",
  SYNC: "finrp-sync",
  WEBHOOK: "finrp-webhook",
  TAX: "finrp-tax",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ---------------------------------------------------------------------------
// Typed event payloads (unchanged shapes — preserved for every importer)
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
// Dispatch helpers — thin wrappers over inngest.send(). Each returns the
// Inngest event id, which callers persist in the (legacy-named) bullmqJobId
// column purely as a correlation handle.
//
// Idempotency note: we deliberately do NOT set a permanent event id here.
// The import/sync/webhook functions re-read the owning DB record and skip
// terminal states, so a failed job can still be retried from the UI while
// duplicate concurrent dispatches are absorbed by that status check. Inngest
// additionally retries transient failures automatically.
// ---------------------------------------------------------------------------

export async function enqueueImport(data: ImportJobData): Promise<string> {
  const { ids } = await inngest.send({ name: EVENTS.CSV_IMPORT_REQUESTED, data });
  const eventId = ids[0] ?? `import_${data.importJobId}`;
  console.log("[dispatch] csv/import.requested", { importJobId: data.importJobId, eventId });
  return eventId;
}

export async function enqueueSync(data: SyncJobData, delayMs = 0): Promise<string> {
  const { ids } = await inngest.send({
    name: EVENTS.INTEGRATION_SYNC_REQUESTED,
    data,
    // Inngest delays delivery when `ts` is in the future (batches webhook bursts).
    ...(delayMs > 0 ? { ts: Date.now() + delayMs } : {}),
  });
  return ids[0] ?? data.syncJobId;
}

export async function enqueueWebhook(data: WebhookJobData): Promise<string> {
  const { ids } = await inngest.send({ name: EVENTS.WEBHOOK_ZOHO_RECEIVED, data });
  return ids[0] ?? data.webhookEventId;
}

// ---------------------------------------------------------------------------
// Scheduled per-integration sync.
//
// Replaced by the `integration-scheduled-sync` cron function which scans for
// integrations due for refresh (see inngest/functions/scheduled.ts). Kept as
// a no-op so existing callers (e.g. the Zoho OAuth callback) don't break.
// ---------------------------------------------------------------------------
export async function scheduleRepeatingSync(
  integrationId: string,
  _organizationId: string,
  _connectorType: string,
  _intervalMinutes: number
): Promise<void> {
  console.log(
    `[dispatch] scheduleRepeatingSync is a no-op — integration ${integrationId} ` +
      `is now refreshed by the integration-scheduled-sync cron.`
  );
}

// ---------------------------------------------------------------------------
// Queue health — now derived from the BackgroundJob ledger, mapped onto the
// legacy { waiting, active, completed, failed } shape the health route reads.
// ---------------------------------------------------------------------------
export async function getQueueHealth(): Promise<
  Record<string, { waiting: number; active: number; completed: number; failed: number }>
> {
  const health = await getBackgroundJobHealth();
  const shape = {
    waiting: health.QUEUED,
    active: health.RUNNING + health.RETRYING,
    completed: health.COMPLETED,
    failed: health.FAILED,
  };
  // The per-domain split is no longer meaningful with a single ledger; we
  // surface the same aggregate under each key to preserve the response shape.
  return { import: shape, sync: shape, webhook: shape };
}
