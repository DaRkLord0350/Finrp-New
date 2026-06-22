// ============================================================
// FinRP — Analytics dispatch (Inngest-backed)
// Call these helpers from API routes/actions after data mutations to
// schedule background precomputation of dashboard/firm/compliance
// snapshots. Coalescing of rapid bursts is handled by the analytics
// Inngest function's `debounce` config (inngest/functions/analytics.ts).
// ============================================================

import { inngest } from "@/inngest/client";
import { EVENTS } from "@/inngest/events";

export type AnalyticsJobData =
  | { type: "dashboard"; organizationId: string }
  | { type: "monthly"; organizationId: string; year: number; month: number }
  | { type: "firm"; organizationId: string }
  | { type: "compliance"; organizationId: string }
  | { type: "all_orgs" }; // admin cron: recompute every org

export async function enqueueAnalyticsSnapshot(data: AnalyticsJobData): Promise<void> {
  await inngest.send({ name: EVENTS.ANALYTICS_SNAPSHOT_REQUESTED, data });
}

// Convenience helpers used in API routes after mutations
export async function scheduleOrgSnapshot(organizationId: string) {
  await enqueueAnalyticsSnapshot({ type: "dashboard", organizationId });
}

export async function scheduleMonthlySnapshot(organizationId: string) {
  const now = new Date();
  await enqueueAnalyticsSnapshot({
    type: "monthly",
    organizationId,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
}
