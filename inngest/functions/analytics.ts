// ============================================================
// Inngest function — Analytics snapshot precomputation
// Replaces the BullMQ analytics worker. `debounce` coalesces rapid
// bursts (e.g. many mutations in a row) per organization+type, mirroring
// the old jobId-dedup-with-delay behaviour.
// ============================================================

import { inngest } from "@/inngest/client";
import { EVENTS } from "@/inngest/events";
import { runAnalyticsSnapshot } from "@/lib/workers/analytics-worker";
import type { AnalyticsJobData } from "@/lib/workers/analytics-queue";

export const analyticsSnapshot = inngest.createFunction(
  {
    id: "analytics-snapshot",
    name: "Analytics Snapshot",
    concurrency: 2,
    // Collapse bursts: at most one run per org+type per 10s window.
    // NOTE: this is a CEL expression, not JavaScript — CEL has no `??`,
    // so use has()/ternary for the org fallback.
    debounce: {
      period: "10s",
      key: "event.data.type + '-' + (has(event.data.organizationId) ? event.data.organizationId : 'all')",
    },
    retries: 3,
    triggers: [{ event: EVENTS.ANALYTICS_SNAPSHOT_REQUESTED }],
  },
  async ({ event, step }) => {
    const data = event.data as AnalyticsJobData;
    await step.run("compute-snapshot", () => runAnalyticsSnapshot(data));
    return { type: data.type, status: "COMPLETED" };
  }
);
