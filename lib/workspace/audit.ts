// ============================================================
// lib/workspace/audit.ts
//
// Client Workspace audit logger.
//
// Every workspace session boundary (ENTER / EXIT / SWITCH),
// every mutation a CA performs on behalf of a client, and every
// permission denial is recorded in ClientActivityLog.
//
// Writes are fire-and-forget by default — an audit insert
// failure must never break the business request (same contract
// as lib/audit.ts).
// ============================================================

import { prisma } from "@/lib/prisma";
import { ClientActivityAction, Prisma } from "@prisma/client";

export interface ClientActivityInput {
  caUserId: string;
  organizationId: string;
  action: ClientActivityAction;
  summary: string;
  method?: string;
  path?: string;
  entity?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

/** Awaited variant — use at session boundaries (enter/exit/switch). */
export async function recordClientActivity(input: ClientActivityInput): Promise<void> {
  try {
    await prisma.clientActivityLog.create({
      data: {
        caUserId: input.caUserId,
        organizationId: input.organizationId,
        action: input.action,
        summary: input.summary,
        method: input.method ?? null,
        path: input.path ?? null,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        metadata: input.metadata ?? undefined,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    console.error("[workspace:audit] failed to write activity log:", err);
  }
}

/** Fire-and-forget variant — use on the per-request hot path. */
export function logClientActivity(input: ClientActivityInput): void {
  void recordClientActivity(input);
}

// ---------------------------------------------------------------------------
// HTTP method → audit action mapping for API mutations
// ---------------------------------------------------------------------------
const MUTATION_ACTIONS: Record<string, ClientActivityAction> = {
  POST: "CREATE",
  PUT: "UPDATE",
  PATCH: "UPDATE",
  DELETE: "DELETE",
};

export function mutationActionForMethod(method: string): ClientActivityAction | null {
  return MUTATION_ACTIONS[method.toUpperCase()] ?? null;
}

/**
 * Derives a human-readable entity name from an API path:
 *   /api/erp/sales            → "sales"
 *   /api/banking/transactions → "transactions"
 *   /api/invoices/ckx.../send → "send" is skipped → "invoices"
 * Segments that look like ids (cuid/uuid/numeric) are ignored.
 */
export function entityFromPath(path: string): string | undefined {
  const segments = path.split("?")[0].split("/").filter(Boolean);
  const meaningful = segments.filter(
    (s) =>
      s !== "api" &&
      !/^c[a-z0-9]{20,}$/i.test(s) && // cuid
      !/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(s) && // uuid
      !/^\d+$/.test(s)
  );
  return meaningful[meaningful.length - 1];
}

// ---------------------------------------------------------------------------
// Query helpers — used by /api/ca/workspace/activity and the
// CA portal activity page.
// ---------------------------------------------------------------------------
export async function getClientActivity(opts: {
  organizationId?: string;
  caUserId?: string;
  limit?: number;
  cursor?: string;
}) {
  const limit = Math.min(opts.limit ?? 50, 200);

  const logs = await prisma.clientActivityLog.findMany({
    where: {
      ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
      ...(opts.caUserId ? { caUserId: opts.caUserId } : {}),
    },
    include: {
      caUser: { select: { name: true, email: true } },
      organization: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });

  const hasMore = logs.length > limit;
  const items = hasMore ? logs.slice(0, limit) : logs;
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}
