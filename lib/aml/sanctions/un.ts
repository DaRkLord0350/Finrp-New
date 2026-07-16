// ============================================================
// lib/aml/sanctions/un.ts
//
// UN Security Council Consolidated Sanctions List — real fetch +
// parse of the standard consolidated.xml format (root
// <CONSOLIDATED_LIST><INDIVIDUALS><INDIVIDUAL>... and
// <ENTITIES><ENTITY>...). Long-stable, publicly documented UN format,
// parsed defensively for the same reason as OFAC's parser.
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

export async function fetchAndParseUnConsolidated(): Promise<WatchlistEntryData[]> {
  const url = getSanctionsFeedUrl("UN_CONSOLIDATED");
  const res = await fetch(url, { headers: { Accept: "application/xml" } });
  if (!res.ok) throw new Error(`UN Consolidated List feed returned HTTP ${res.status}`);
  const xml = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
    isArray: (name) => ["INDIVIDUAL", "ENTITY", "INDIVIDUAL_ALIAS", "ENTITY_ALIAS"].includes(name),
  });
  const doc = parser.parse(xml) as Record<string, unknown>;
  const root = (doc.CONSOLIDATED_LIST ?? {}) as Record<string, unknown>;

  const individuals = asArray(
    ((root.INDIVIDUALS as Record<string, unknown> | undefined)?.INDIVIDUAL) as Record<string, unknown>[]
  ).map((entry): WatchlistEntryData | null => {
    const refNumber = textOf(entry.REFERENCE_NUMBER) ?? textOf(entry.DATAID);
    if (!refNumber) return null;

    const nameParts = [entry.FIRST_NAME, entry.SECOND_NAME, entry.THIRD_NAME, entry.FOURTH_NAME]
      .map(textOf)
      .filter(Boolean);
    const primaryName = nameParts.join(" ") || `UN-${refNumber}`;

    const aliasList = asArray((entry.INDIVIDUAL_ALIAS as Record<string, unknown>[]) ?? []);
    const aliases = aliasList.map((a) => textOf((a as Record<string, unknown>).ALIAS_NAME)).filter((n): n is string => Boolean(n));

    return {
      externalId: refNumber,
      entityType: "INDIVIDUAL",
      primaryName,
      aliases,
      nationality: textOf(entry.NATIONALITY),
      dob: textOf(entry.INDIVIDUAL_DATE_OF_BIRTH),
      program: textOf(entry.UN_LIST_TYPE),
      listedDate: textOf(entry.LISTED_ON),
      rawData: entry,
    };
  });

  const entities = asArray(
    ((root.ENTITIES as Record<string, unknown> | undefined)?.ENTITY) as Record<string, unknown>[]
  ).map((entry): WatchlistEntryData | null => {
    const refNumber = textOf(entry.REFERENCE_NUMBER) ?? textOf(entry.DATAID);
    if (!refNumber) return null;

    const primaryName = textOf(entry.FIRST_NAME) || `UN-ENTITY-${refNumber}`;
    const aliasList = asArray((entry.ENTITY_ALIAS as Record<string, unknown>[]) ?? []);
    const aliases = aliasList.map((a) => textOf((a as Record<string, unknown>).ALIAS_NAME)).filter((n): n is string => Boolean(n));

    return {
      externalId: refNumber,
      entityType: "ORGANIZATION",
      primaryName,
      aliases,
      program: textOf(entry.UN_LIST_TYPE),
      listedDate: textOf(entry.LISTED_ON),
      rawData: entry,
    };
  });

  return [...individuals, ...entities].filter((e): e is WatchlistEntryData => e !== null);
}
