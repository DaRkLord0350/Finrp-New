// ============================================================
// lib/team/activity.ts
//
// Append-only audit trail for firm team management. Writes to
// TeamActivityLog (the seed table the Phase 10 audit module builds
// on). Logging never throws into the request path.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type TeamAction =
  | "MEMBER_INVITED"
  | "MEMBER_UPDATED"
  | "MEMBER_DEACTIVATED"
  | "MEMBER_REACTIVATED"
  | "MEMBERS_IMPORTED"
  | "PERMISSIONS_UPDATED"
  | "INVITE_RESENT"
  | "INVITE_REVOKED"
  // Phase 4 — relationship engine (module "ASSIGNMENT" / "CUSTOMER")
  | "CUSTOMER_LINKED"
  | "CUSTOMER_UNLINKED"
  | "CA_ASSIGNED"
  | "CA_REASSIGNED"
  | "CA_UNASSIGNED"
  // Phase 5 — document vault (module "DOCUMENT")
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_VERSION_ADDED"
  | "DOCUMENT_DELETED";

interface LogParams {
  organizationId: string;
  actorId?: string | null;
  actorName?: string | null;
  /** Only set for affected members that already have a User row (FK). */
  targetUserId?: string | null;
  targetEmail?: string | null;
  action: TeamAction;
  /** Defaults to "TEAM"; pass "ASSIGNMENT"/"CUSTOMER" for relationship events. */
  module?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

export async function logTeamActivity(params: LogParams): Promise<void> {
  try {
    await prisma.teamActivityLog.create({
      data: {
        organizationId: params.organizationId,
        actorId: params.actorId ?? null,
        actorName: params.actorName ?? null,
        targetUserId: params.targetUserId ?? null,
        targetEmail: params.targetEmail ?? null,
        action: params.action,
        ...(params.module ? { module: params.module } : {}),
        ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("[team-activity] log failed:", err);
  }
}

// Best-effort client IP from proxy headers.
export function clientIpFrom(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}
