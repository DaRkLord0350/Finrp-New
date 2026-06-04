// ============================================================
// GET /api/imports/[id]/progress — SSE real-time progress stream
//
// Dead-job detection (closes stream + emits "stuck" event):
//   MAPPING    > 90 s  → "Import never entered the queue"
//   QUEUED     > 5 min → "Worker never picked up the job"
//   PROCESSING with stale heartbeat (>5 min) → "Worker heartbeat missing"
//
// The stream has a 10-minute hard cap. On terminal status it closes
// after 600 ms to let the client read the final event.
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TERMINAL_STATUSES      = new Set(["COMPLETED", "FAILED", "PARTIAL", "CANCELLED"]);
const MAPPING_STUCK_MS       = 90_000;          // 90 s
const QUEUED_STUCK_MS        = 5  * 60 * 1000;  // 5 min
const PROCESSING_STUCK_MS    = 5  * 60 * 1000;  // 5 min heartbeat gap
const HARD_LIMIT_MS          = 10 * 60 * 1000;  // 10 min absolute max
const POLL_INTERVAL_MS       = 1_500;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await getCurrentUser();

  const initial = await (prisma as any).importJob.findFirst({
    where: { id, organizationId: user.organizationId },
    select: { id: true },
  });

  if (!initial) {
    return new Response("Import job not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Client disconnected — next poll will detect closed controller
        }
      };

      // Emit initial state immediately
      send(await buildPayload(id, user.organizationId));

      const startTime = Date.now();

      const poll = async () => {
        if (Date.now() - startTime > HARD_LIMIT_MS) {
          send({
            type: "timeout",
            message: "Progress stream closed after 10 minutes. Reload the page to reconnect.",
          });
          safeClose(controller);
          return;
        }

        const payload = await buildPayload(id, user.organizationId);
        send(payload);

        const status = payload.status as string;

        // Terminal — close after brief delay so client reads the event
        if (TERMINAL_STATUSES.has(status)) {
          setTimeout(() => safeClose(controller), 600);
          return;
        }

        // ── Dead-job detection ──────────────────────────────────────────────

        const now = Date.now();

        if (status === "MAPPING") {
          const updatedAt = payload.updatedAt as string | null;
          const stuckMs = updatedAt ? now - new Date(updatedAt).getTime() : 0;
          if (stuckMs > MAPPING_STUCK_MS) {
            send({
              type: "stuck",
              status,
              stuckForMs: stuckMs,
              reason: "Import never entered the queue",
              message:
                `Import has been in MAPPING for ${Math.round(stuckMs / 1000)}s. ` +
                `The mapping POST likely failed silently or Redis was unavailable. ` +
                `Go back to the Map step and resubmit.`,
              action: "retry_mapping",
            });
            safeClose(controller);
            return;
          }
        }

        if (status === "QUEUED" || status === "PENDING") {
          const queuedAt = payload.queuedAt as string | null;
          const updatedAt = payload.updatedAt as string | null;
          const ref = queuedAt ?? updatedAt;
          const stuckMs = ref ? now - new Date(ref).getTime() : 0;
          if (stuckMs > QUEUED_STUCK_MS) {
            send({
              type: "stuck",
              status,
              stuckForMs: stuckMs,
              reason: "Worker never picked up the job",
              message:
                `Import has been queued for ${Math.round(stuckMs / 60_000)} min. ` +
                `The worker process may be down or Redis is disconnected. ` +
                `Check /api/imports/queue-health for diagnostics.`,
              action: "check_worker",
            });
            safeClose(controller);
            return;
          }
        }

        if (status === "PROCESSING") {
          const lastHeartbeat = payload.lastHeartbeatAt as string | null;
          const startedAt = payload.startedAt as string | null;
          const ref = lastHeartbeat ?? startedAt;
          const stuckMs = ref ? now - new Date(ref).getTime() : 0;
          if (stuckMs > PROCESSING_STUCK_MS) {
            send({
              type: "stuck",
              status,
              stuckForMs: stuckMs,
              reason: "Worker heartbeat missing",
              message:
                `Worker heartbeat is ${Math.round(stuckMs / 60_000)} min stale. ` +
                `The import worker may have crashed mid-processing. ` +
                `The stuck-job checker will auto-fail this in <5 min.`,
              action: "wait_or_contact_support",
            });
            safeClose(controller);
            return;
          }
        }

        setTimeout(poll, POLL_INTERVAL_MS);
      };

      setTimeout(poll, POLL_INTERVAL_MS);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":    "text/event-stream",
      "Cache-Control":   "no-cache, no-transform",
      "Connection":      "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ---------------------------------------------------------------------------
// Build the SSE payload from the DB record
// ---------------------------------------------------------------------------

async function buildPayload(
  importJobId: string,
  organizationId: string
): Promise<Record<string, unknown>> {
  const job = await (prisma as any).importJob.findFirst({
    where: { id: importJobId, organizationId },
    select: {
      id:               true,
      status:           true,
      entity:           true,
      totalRows:        true,
      processedRows:    true,
      successRows:      true,
      failedRows:       true,
      skippedRows:      true,
      duplicateRows:    true,
      startedAt:        true,
      completedAt:      true,
      queuedAt:         true,
      failedAt:         true,
      lastHeartbeatAt:  true,
      updatedAt:        true,
      bullmqJobId:      true,
      error:            true,
    },
  });

  if (!job) {
    return { type: "error", message: "Import job not found or access denied" };
  }

  const percent =
    job.totalRows > 0
      ? Math.round((job.processedRows / job.totalRows) * 100)
      : 0;

  return {
    type:            "progress",
    status:          job.status,
    progress:        percent,
    totalRows:       job.totalRows,
    processedRows:   job.processedRows,
    successRows:     job.successRows,
    failedRows:      job.failedRows,
    skippedRows:     job.skippedRows,
    duplicateRows:   job.duplicateRows,
    startedAt:       job.startedAt,
    completedAt:     job.completedAt,
    queuedAt:        job.queuedAt,
    failedAt:        job.failedAt,
    lastHeartbeatAt: job.lastHeartbeatAt,
    updatedAt:       job.updatedAt,
    bullmqJobId:     job.bullmqJobId,
    error:           job.error,
  };
}

function safeClose(controller: ReadableStreamDefaultController) {
  try {
    controller.close();
  } catch {
    // Already closed by client disconnect
  }
}
