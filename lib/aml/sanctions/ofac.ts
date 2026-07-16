// ============================================================
// lib/aml/sanctions/ofac.ts
//
// OFAC SDN (Specially Designated Nationals) list — real fetch + parse
// of the standard SDN.XML format (root <sdnList><sdnEntry>...). This
// is a long-stable, publicly documented US Treasury format, not an
// undocumented private API — parsed defensively (missing/renamed
// fields degrade gracefully rather than crashing the sync) since
// OFAC does occasionally make minor schema revisions.
// ============================================================

import { XMLParser } from "fast-xml-parser";
import { getSanctionsFeedUrl } from "./config";
import type { WatchlistEntryData } from "./types";

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function textOf(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>)["#text"]).trim() || undefined;
  }
  return String(v).trim() || undefined;
}

export async function fetchAndParseOfacSdn(): Promise<WatchlistEntryData[]> {
  const url = getSanctionsFeedUrl("OFAC_SDN");
  const res = await fetch(url, { headers: { Accept: "application/xml" } });
  if (!res.ok) throw new Error(`OFAC SDN feed returned HTTP ${res.status}`);
  const xml = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
    isArray: (name) => ["sdnEntry", "aka", "program", "nationality", "id"].includes(name),
  });
  const doc = parser.parse(xml) as Record<string, unknown>;

  const sdnList = (doc.sdnList ?? {}) as Record<string, unknown>;
  const entries = asArray(sdnList.sdnEntry as Record<string, unknown> | Record<string, unknown>[]);

  return entries
    .map((entry): WatchlistEntryData | null => {
      const uid = textOf(entry.uid);
      if (!uid) return null;

      const firstName = textOf(entry.firstName);
      const lastName = textOf(entry.lastName);
      const primaryName = [firstName, lastName].filter(Boolean).join(" ").trim() || textOf(entry.lastName) || `SDN-${uid}`;

      const akaList = (entry.akaList as Record<string, unknown> | undefined)?.aka;
      const aliases = asArray(akaList as Record<string, unknown> | Record<string, unknown>[])
        .map((aka) => [textOf(aka.firstName), textOf(aka.lastName)].filter(Boolean).join(" ").trim())
        .filter((n): n is string => Boolean(n));

      const programList = (entry.programList as Record<string, unknown> | undefined)?.program;
      const programs = asArray(programList as unknown[]).map((p) => textOf(p)).filter(Boolean);

      const nationalityList = (entry.nationalityList as Record<string, unknown> | undefined)?.nationality;
      const nationalities = asArray(nationalityList as Record<string, unknown>[])
        .map((n) => textOf((n as Record<string, unknown>).country))
        .filter(Boolean);

      const sdnType = textOf(entry.sdnType);

      return {
        externalId: uid,
        entityType: sdnType === "Individual" ? "INDIVIDUAL" : sdnType === "Vessel" ? "VESSEL" : "ORGANIZATION",
        primaryName,
        aliases,
        nationality: nationalities[0],
        program: programs.join(", ") || undefined,
        rawData: entry as Record<string, unknown>,
      };
    })
    .filter((e): e is WatchlistEntryData => e !== null);
}
