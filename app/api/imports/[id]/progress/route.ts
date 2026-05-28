// ============================================================
// GET /api/imports/[id]/progress — SSE real-time progress stream
// Uses Server-Sent Events to push job progress updates.
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  // Verify the import job belongs to this org
  const importJob = await (prisma as any).importJob.findFirst({
    where: { id, organizationId: user.organizationId },
  });

  if (!importJob) {
    return new Response("Not found", { status: 404 });
  }

  // Set up SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        const payload = `data: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Client disconnected
        }
      };

      // Send initial state
      send(await buildProgressPayload(id, user.organizationId));

      // Poll every 1.5 seconds until done
      const maxDuration = 5 * 60 * 1000; // 5 minutes
      const startTime = Date.now();
      const interval = 1500;

      const poll = async () => {
        if (Date.now() - startTime > maxDuration) {
          send({ type: "timeout", message: "Polling timed out" });
          controller.close();
          return;
        }

        const payload = await buildProgressPayload(id, user.organizationId);
        send(payload);

        if (["COMPLETED", "FAILED", "PARTIAL", "CANCELLED"].includes(payload.status as string)) {
          // Final state — close stream
          setTimeout(() => {
            try { controller.close(); } catch { /* already closed */ }
          }, 600);
          return;
        }

        setTimeout(poll, interval);
      };

      setTimeout(poll, interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ---------------------------------------------------------------------------
// Build progress payload from DB
// ---------------------------------------------------------------------------

async function buildProgressPayload(
  importJobId: string,
  organizationId: string
): Promise<Record<string, unknown>> {
  const job = await (prisma as any).importJob.findFirst({
    where: { id: importJobId, organizationId },
    select: {
      id: true,
      status: true,
      totalRows: true,
      processedRows: true,
      successRows: true,
      failedRows: true,
      skippedRows: true,
      duplicateRows: true,
      startedAt: true,
      completedAt: true,
    },
  });

  if (!job) {
    return { type: "error", message: "Import job not found" };
  }

  const percent =
    job.totalRows > 0
      ? Math.round((job.processedRows / job.totalRows) * 100)
      : 0;

  return {
    type: "progress",
    status: job.status,
    progress: percent,
    totalRows: job.totalRows,
    processedRows: job.processedRows,
    successRows: job.successRows,
    failedRows: job.failedRows,
    skippedRows: job.skippedRows,
    duplicateRows: job.duplicateRows,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}
