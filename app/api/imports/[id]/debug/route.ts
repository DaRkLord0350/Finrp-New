// ============================================================
// GET /api/imports/[id]/debug
// Full lifecycle diagnostics for a specific import job.
// Returns DB state, BackgroundJob (Inngest) state, and recommendations.
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();

  // ── Load full import record ───────────────────────────────────────────────
  const importJob = await (prisma as any).importJob.findFirst({
    where: { id, organizationId: user.organizationId },
  });

  if (!importJob) {
    return NextResponse.json({ error: "Import job not found" }, { status: 404 });
  }

  const now = Date.now();

  // ── BackgroundJob (Inngest) state ─────────────────────────────────────────
  let queueState: Record<string, unknown> = { available: false };

  try {
    const bg = await prisma.backgroundJob.findFirst({
      where: { type: "csv.import", referenceId: id, organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
      select: {
        status: true,
        progress: true,
        attempts: true,
        error: true,
        runId: true,
        eventId: true,
        startedAt: true,
        completedAt: true,
      },
    });
    if (bg) {
      queueState = {
        available: true,
        jobState: bg.status,
        progress: bg.progress,
        attemptsMade: bg.attempts,
        failedReason: bg.error ?? null,
        runId: bg.runId,
        eventId: bg.eventId,
        startedAt: bg.startedAt,
        finishedOn: bg.completedAt,
        note: "Live execution state is also visible in the Inngest dashboard (run id above).",
      };
    } else {
      queueState = {
        available: true,
        jobState: "not_found",
        note: "No BackgroundJob ledger row yet — the import event may not have been picked up.",
      };
    }
  } catch (err) {
    queueState = { available: false, error: (err as Error).message };
  }

  // ── Recent import errors ──────────────────────────────────────────────────
  const recentErrors = await (prisma as any).importError.findMany({
    where: { importJobId: id },
    select: { rowIndex: true, field: true, errorCode: true, message: true, severity: true },
    take: 20,
    orderBy: { createdAt: "desc" },
  });

  // ── Row counts by status ──────────────────────────────────────────────────
  let rowCounts: Record<string, number> = {};
  try {
    const counts = await (prisma as any).importRow.groupBy({
      by: ["status"],
      where: { importJobId: id },
      _count: { _all: true },
    });
    rowCounts = Object.fromEntries(
      (counts as Array<{ status: string; _count: { _all: number } }>)
        .map((r) => [r.status, r._count._all])
    );
  } catch { /* importRow table may be empty */ }

  // ── Diagnostics ───────────────────────────────────────────────────────────
  const status: string = importJob.status;
  const updatedAt = importJob.updatedAt ? new Date(importJob.updatedAt).getTime() : now;
  const startedAt = importJob.startedAt ? new Date(importJob.startedAt).getTime() : null;
  const lastHeartbeat = importJob.lastHeartbeatAt
    ? new Date(importJob.lastHeartbeatAt).getTime()
    : null;

  const stuckForMs = now - updatedAt;

  const issues: string[] = [];
  let recommendation = "";

  if (status === "MAPPING" && stuckForMs > 10 * 60 * 1000) {
    issues.push("Import stuck in MAPPING >10 min — user has not submitted mapping or the POST failed");
    recommendation = "Return to the import wizard and resubmit column mapping.";
  }

  if (status === "QUEUED" && stuckForMs > 5 * 60 * 1000) {
    issues.push("Import stuck in QUEUED >5 min — the Inngest function may not have picked up the event");
    recommendation = "Check that the Inngest dev server (or Inngest Cloud) is connected to /api/inngest. " +
      "The stuck-job-checker cron will re-dispatch or fail it within 5 min.";
  }

  if (status === "PROCESSING") {
    const heartbeatAgeMs = lastHeartbeat ? now - lastHeartbeat : (startedAt ? now - startedAt : Infinity);
    if (heartbeatAgeMs > 5 * 60 * 1000) {
      issues.push(`Worker heartbeat stale by ${Math.round(heartbeatAgeMs / 1000)}s — worker may have crashed`);
      recommendation = "The stuck-job checker will mark this FAILED within 5 min. You can then retry.";
    }
  }

  if (!importJob.fieldMapping || !Array.isArray(importJob.fieldMapping)) {
    issues.push("fieldMapping is null or not an array — mapping was never saved correctly");
  }

  if (Array.isArray(importJob.fieldMapping) && importJob.fieldMapping.length === 0) {
    issues.push("fieldMapping is an empty array — at least 1 rule is required");
  }

  if (!importJob.bullmqJobId && ["QUEUED", "PROCESSING"].includes(status)) {
    issues.push(`bullmqJobId is null in DB but status=${status} — enqueue succeeded but DB update failed`);
  }

  if (issues.length === 0 && ["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"].includes(status)) {
    recommendation = `Import is in a terminal state (${status}). No action required.`;
  }

  return NextResponse.json({
    importJob: {
      id:                  importJob.id,
      status,
      entity:              importJob.entity,
      fileName:            importJob.originalName ?? importJob.fileName,
      fileSize:            importJob.fileSize,
      totalRows:           importJob.totalRows,
      processedRows:       importJob.processedRows,
      successRows:         importJob.successRows,
      failedRows:          importJob.failedRows,
      duplicateRows:       importJob.duplicateRows,
      startedAt:           importJob.startedAt,
      completedAt:         importJob.completedAt,
      queuedAt:            importJob.queuedAt,
      failedAt:            importJob.failedAt,
      lastHeartbeatAt:     importJob.lastHeartbeatAt,
      bullmqJobId:         importJob.bullmqJobId,
      retryCount:          importJob.retryCount,
      error:               importJob.error,
      fieldMappingCount:   Array.isArray(importJob.fieldMapping) ? importJob.fieldMapping.length : null,
      detectedColumnsCount: importJob.detectedColumns?.length ?? 0,
      createdAt:           importJob.createdAt,
      updatedAt:           importJob.updatedAt,
    },
    queueState,
    rowCounts,
    recentErrors,
    diagnostics: {
      stuckForMs,
      stuckForMin:      Math.round(stuckForMs / 60_000),
      issues,
      recommendation,
      isHealthy:        issues.length === 0,
    },
    timestamp: new Date().toISOString(),
  });
}
