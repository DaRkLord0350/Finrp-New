// ============================================================
// inngest/functions/aml.ts
// Daily sanctions-list re-sync (OFAC + UN) — global data, runs once
// for the whole platform, not per-tenant. Mirrors the cron shape in
// inngest/functions/scheduled.ts.
// ============================================================

import { inngest } from "@/inngest/client";
import { syncWatchlist } from "@/lib/aml/sanctions/service";
import { SanctionsFeedNotConfiguredError } from "@/lib/aml/sanctions/config";

export const amlWatchlistDailySync = inngest.createFunction(
  { id: "aml-watchlist-daily-sync", name: "AML — Watchlist Daily Sync", triggers: [{ cron: "TZ=Asia/Kolkata 0 5 * * *" }] },
  async ({ step }) => {
    const results: { source: string; ingested?: number; skipped?: boolean; error?: string }[] = [];

    for (const source of ["OFAC_SDN", "UN_CONSOLIDATED"] as const) {
      const result = await step.run(`sync-${source.toLowerCase()}`, async () => {
        try {
          return await syncWatchlist(source);
        } catch (err) {
          if (err instanceof SanctionsFeedNotConfiguredError) {
            return { source, skipped: true, error: err.message };
          }
          return { source, error: err instanceof Error ? err.message : String(err) };
        }
      });
      results.push(result);
    }

    return { results };
  }
);
