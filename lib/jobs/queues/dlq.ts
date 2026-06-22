// ============================================================
// FinRP — Dead Letter surface (DB-backed)
//
// With Inngest, runs that exhaust their retry budget are retained and
// inspectable in the Inngest dashboard, and our functions mark the
// owning BackgroundJob row FAILED. "DLQ depth" is therefore simply the
// count of FAILED background jobs — no separate Redis queue required.
// ============================================================

import { prisma } from "@/lib/prisma";

export const DLQ_NAME = "finrp-dlq" as const;

export async function getDlqHealth(): Promise<{ depth: number; failed: number; error?: string }> {
  try {
    const failed = await prisma.backgroundJob.count({ where: { status: "FAILED" } });
    return { depth: failed, failed };
  } catch {
    return { depth: -1, failed: -1, error: "DLQ unavailable" };
  }
}
