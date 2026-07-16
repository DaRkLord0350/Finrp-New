// ============================================================
// lib/aml/sanctions/service.ts
// Orchestrates a full watchlist sync: fetch + parse + upsert (global,
// no organizationId — see schema comment) + log. Called by the daily
// Inngest cron and available for an on-demand admin trigger.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { AMLWatchlistSource, Prisma } from "@prisma/client";
import { fetchAndParseOfacSdn } from "./ofac";
import { fetchAndParseUnConsolidated } from "./un";
import type { WatchlistEntryData } from "./types";

const FETCHERS: Record<"OFAC_SDN" | "UN_CONSOLIDATED", () => Promise<WatchlistEntryData[]>> = {
  OFAC_SDN: fetchAndParseOfacSdn,
  UN_CONSOLIDATED: fetchAndParseUnConsolidated,
};

export async function syncWatchlist(source: "OFAC_SDN" | "UN_CONSOLIDATED") {
  const syncLog = await prisma.aMLWatchlistSyncLog.create({ data: { source: source as AMLWatchlistSource, status: "RUNNING" } });

  try {
    const entries = await FETCHERS[source]();

    let ingested = 0;
    for (const entry of entries) {
      await prisma.aMLWatchlistEntry.upsert({
        where: { source_externalId: { source: source as AMLWatchlistSource, externalId: entry.externalId } },
        create: {
          source: source as AMLWatchlistSource,
          externalId: entry.externalId,
          entityType: entry.entityType,
          primaryName: entry.primaryName,
          aliases: entry.aliases,
          nationality: entry.nationality,
          dob: entry.dob,
          program: entry.program,
          listedDate: entry.listedDate ? new Date(entry.listedDate) : undefined,
          rawData: entry.rawData as Prisma.InputJsonValue,
          isActive: true,
        },
        update: {
          primaryName: entry.primaryName,
          aliases: entry.aliases,
          nationality: entry.nationality,
          dob: entry.dob,
          program: entry.program,
          listedDate: entry.listedDate ? new Date(entry.listedDate) : undefined,
          rawData: entry.rawData as Prisma.InputJsonValue,
          isActive: true,
          ingestedAt: new Date(),
        },
      });
      ingested++;
    }

    await prisma.aMLWatchlistSyncLog.update({
      where: { id: syncLog.id },
      data: { status: "SUCCESS", completedAt: new Date(), recordsIngested: ingested },
    });
    return { source, ingested };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.aMLWatchlistSyncLog.update({
      where: { id: syncLog.id },
      data: { status: "FAILED", completedAt: new Date(), errorMessage: message },
    });
    throw err;
  }
}

export async function getLastSyncStatus() {
  const sources: ("OFAC_SDN" | "UN_CONSOLIDATED")[] = ["OFAC_SDN", "UN_CONSOLIDATED"];
  const results = await Promise.all(
    sources.map(async (source) => {
      const [lastSync, entryCount] = await Promise.all([
        prisma.aMLWatchlistSyncLog.findFirst({ where: { source: source as AMLWatchlistSource }, orderBy: { startedAt: "desc" } }),
        prisma.aMLWatchlistEntry.count({ where: { source: source as AMLWatchlistSource, isActive: true } }),
      ]);
      return { source, lastSync, entryCount };
    })
  );
  return results;
}
