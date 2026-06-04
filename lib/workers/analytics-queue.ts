// ============================================================
// FinRP — Analytics BullMQ Queue
// Use analyticsQueue.add() from API routes/actions to schedule
// background precomputation after data mutations.
// ============================================================

import { Queue } from "bullmq";
import { BULLMQ_CONNECTION } from "@/lib/redis";

export type AnalyticsJobData =
  | { type: "dashboard";   organizationId: string }
  | { type: "monthly";     organizationId: string; year: number; month: number }
  | { type: "firm";        organizationId: string }
  | { type: "compliance";  organizationId: string }
  | { type: "all_orgs" };   // admin cron: recompute every org

export const analyticsQueue = new Queue<AnalyticsJobData>("analytics", {
  connection: BULLMQ_CONNECTION,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { count: 200 },
    removeOnFail:    { count: 100 },
  },
});

// Convenience helpers used in API routes after mutations
export async function scheduleOrgSnapshot(organizationId: string) {
  await analyticsQueue.add(
    `dashboard:${organizationId}`,
    { type: "dashboard", organizationId },
    { jobId: `dashboard:${organizationId}`, delay: 2_000 } // de-duplicate within 2s
  );
}

export async function scheduleMonthlySnapshot(organizationId: string) {
  const now = new Date();
  await analyticsQueue.add(
    `monthly:${organizationId}:${now.getFullYear()}-${now.getMonth() + 1}`,
    { type: "monthly", organizationId, year: now.getFullYear(), month: now.getMonth() + 1 },
    {
      jobId: `monthly:${organizationId}:${now.getFullYear()}-${now.getMonth() + 1}`,
      delay: 5_000,
    }
  );
}
